import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ageText, mask } from '../common/format';
import { presentCaseType } from '../content/case-type.presenter';
import { CryptoService } from '../core/crypto.service';
import { StorageService } from '../storage/storage.service';
import { CANCELLABLE_STATUSES, STATUS_BADGE, statusLabel, TIMELINE_LABEL } from './status';

export const requestInclude = {
  caseType: true,
  patient: { include: { facilityRecord: true } },
  facility: { select: { id: true, name: true, type: true, phone: true, medicalRecordSource: true } },
  destination: { select: { id: true, name: true } },
  ambulance: true,
  photos: { orderBy: { createdAt: 'asc' } },
  statusLogs: { orderBy: { createdAt: 'asc' } },
  offers: true,
  reporter: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.EmergencyRequestInclude;

export type FullRequest = Prisma.EmergencyRequestGetPayload<{ include: typeof requestInclude }>;

/** Serialisasi permintaan untuk aplikasi mobile (pelapor/petugas) & dashboard web. */
@Injectable()
export class RequestPresenter {
  constructor(
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
  ) {}

  /** `EmergencyRequest` (docs/api_contract.md §2.5). `forCrew` menambah data kontak & identitas lengkap. */
  forMobile(r: FullRequest, forCrew = false) {
    const identity = this.crypto.decrypt(r.patient.identityEncrypted);
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      status_label: statusLabel(r.status, r.facility?.name, r.destination?.name),
      status_badge: STATUS_BADGE[r.status],
      case_type: presentCaseType(r.caseType),
      case_type_other: r.caseTypeOther,
      patient: {
        id: r.patient.id,
        name: r.patient.name,
        identity_number_masked: mask(identity, 2),
        ...(forCrew ? { identity_number: identity } : {}),
        age_text: ageText(r.patient.birthDate, r.patient.ageYears),
        gender: r.patient.gender,
      },
      location: { lat: r.lat, lng: r.lng, address: r.address },
      description: r.description,
      photos: r.photos.map((p) => ({ id: p.id, url: this.storage.signedUrl(p.objectKey) })),
      provider: r.facility ? { id: r.facility.id, name: r.facility.name, type: r.facility.type, phone: r.facility.phone } : null,
      destination: r.destination ? { id: r.destination.id, name: r.destination.name } : null,
      ambulance: r.ambulance
        ? {
            id: r.ambulance.id,
            name: r.ambulance.name,
            plate_number: r.ambulance.plateNumber,
            type: r.ambulance.type,
            location:
              r.ambulance.lastLat !== null && r.ambulance.lastLng !== null
                ? { lat: r.ambulance.lastLat, lng: r.ambulance.lastLng, heading: r.ambulance.lastHeading, updated_at: r.ambulance.lastLocationAt }
                : null,
          }
        : null,
      eta_seconds: r.etaSeconds,
      timeline: this.timeline(r),
      can_cancel: CANCELLABLE_STATUSES.includes(r.status),
      requested_at: r.requestedAt,
      updated_at: r.updatedAt,
      ...(forCrew ? { reporter_phone: r.reporter.phone, reporter_name: r.reporter.name } : {}),
    };
  }

  /** Item "Data Kasus Masuk" dari sudut pandang penyedia `facilityId` (null = super admin). */
  forOperator(r: FullRequest, facilityId: string | null) {
    const recordFacilityId = r.facilityId ?? facilityId;
    const record = recordFacilityId ? r.patient.facilityRecord.find((x) => x.facilityId === recordFacilityId) : undefined;
    const offer = r.offers.find((o) => o.status === 'OFFERED' && (facilityId === null || o.facilityId === facilityId));
    const canAccept = r.status === 'MENUNGGU' && Boolean(offer) && facilityId !== null;
    return {
      id: r.id,
      code: r.code,
      medical_record_no: record?.medicalRecordNo ?? null,
      medical_record_source: r.facility?.medicalRecordSource ?? 'MANUAL',
      simrs_status: record?.simrsStatus ?? (r.facility?.medicalRecordSource === 'SIMRS' ? 'PENDING' : 'NOT_CONFIGURED'),
      simrs_message: record?.simrsMessage ?? null,
      patient: {
        id: r.patient.id,
        name: r.patient.name,
        identity_number: this.crypto.decrypt(r.patient.identityEncrypted),
        age_text: ageText(r.patient.birthDate, r.patient.ageYears),
        gender: r.patient.gender,
      },
      address: r.address,
      case_type: presentCaseType(r.caseType),
      case_type_other: r.caseTypeOther,
      status: r.status,
      status_badge: STATUS_BADGE[r.status],
      timeline: this.timeline(r),
      offer: offer ? { id: offer.id, expires_at: offer.expiresAt } : null,
      actions: { can_accept: canAccept, can_reject: canAccept },
      requested_at: r.requestedAt,
    };
  }

  forOperatorDetail(r: FullRequest, facilityId: string | null) {
    const mobile = this.forMobile(r, true);
    return {
      ...this.forOperator(r, facilityId),
      description: r.description,
      photos: mobile.photos,
      location: mobile.location,
      reporter: { name: r.reporter.name, phone: r.reporter.phone },
      provider: mobile.provider,
      destination: mobile.destination,
      ambulance: mobile.ambulance,
      eta_seconds: r.etaSeconds,
    };
  }

  private timeline(r: FullRequest) {
    return r.statusLogs.map((l) => ({ status: l.toStatus, label: TIMELINE_LABEL[l.toStatus], at: l.createdAt }));
  }
}
