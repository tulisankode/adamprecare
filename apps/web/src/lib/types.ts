// Types mirroring docs/api_contract.md (v1). Field names stay snake_case as sent by the API.

export type Role = "USER" | "CREW" | "FACILITY_OPERATOR" | "FACILITY_ADMIN" | "SUPER_ADMIN";
export type StaffRole = Extract<Role, "FACILITY_OPERATOR" | "FACILITY_ADMIN" | "SUPER_ADMIN">;
export type Gender = "L" | "P";
export type CaseTypeCode = "KECELAKAAN" | "NYERI_DADA" | "SESAK_NAFAS" | "BENCANA_ALAM" | "LAINNYA";
export type RequestStatus =
  | "MENUNGGU"
  | "DITERIMA"
  | "DALAM_PERJALANAN"
  | "TIBA"
  | "MENUJU_FASKES"
  | "SAMPAI_DI_FASKES"
  | "SELESAI"
  | "DIBATALKAN"
  | "TIDAK_TERLAYANI";
export type FacilityType = "RUMAH_SAKIT" | "KLINIK" | "PUSKESMAS" | "PSC_119";
export type AmbulanceType = "PASIEN" | "GAWAT_DARURAT" | "JENAZAH";
export type AmbulanceStatus = "TERSEDIA" | "BERTUGAS" | "NONAKTIF";
export type MedicalRecordSource = "MANUAL" | "SIMRS";
export type SimrsStatus = "NOT_CONFIGURED" | "PENDING" | "FOUND" | "NOT_FOUND" | "NO_IDENTITY" | "ERROR";

// §1.1 envelopes
export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
export interface DataEnvelope<T> {
  data: T;
}
export interface PageEnvelope<T, M extends PageMeta = PageMeta> {
  data: T[];
  meta: M;
}
export interface ApiErrorDetail {
  field: string;
  message: string;
}
export interface ApiErrorBody {
  error: { code: string; message: string; details?: ApiErrorDetail[] };
}

// §2.2 User
export interface FacilityRef {
  id: string;
  name: string;
  type: FacilityType;
}
export interface User {
  id: string;
  role: Role;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  phone_verified?: boolean;
  nik_masked?: string | null;
  birth_date?: string | null;
  gender?: Gender | null;
  avatar_url: string | null;
  has_password?: boolean;
  facility: FacilityRef | null;
}

// §2.1
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

// §2.3
export interface CaseType {
  code: CaseTypeCode;
  name: string;
  icon: string;
  color: string;
  priority: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}
export interface TimelineEntry {
  status: RequestStatus;
  label: string;
  at: string;
}
export interface Photo {
  id: string;
  url: string;
}

// §5.3 operator request item
export interface OperatorRequest {
  id: string;
  code: string;
  medical_record_no: string | null;
  medical_record_source: MedicalRecordSource | null;
  simrs_status: SimrsStatus | null;
  patient: {
    id: string;
    name: string | null;
    identity_number: string | null;
    age_text: string | null;
    gender: Gender | null;
  };
  address: string | null;
  case_type: CaseType;
  case_type_other: string | null;
  status: RequestStatus;
  status_badge: string;
  timeline: TimelineEntry[];
  offer?: { id: string; expires_at: string } | null;
  actions: { can_accept: boolean; can_reject: boolean };
  requested_at: string;
}

export interface OperatorRequestDetail extends OperatorRequest {
  description: string | null;
  photos: Photo[];
  location: (LatLng & { address?: string | null }) | null;
  reporter: { name: string | null; phone: string | null } | null;
  provider: { id: string; name: string; type?: FacilityType; phone?: string | null } | null;
  ambulance: {
    id: string;
    name: string;
    plate_number: string;
    type?: AmbulanceType;
    location?: (LatLng & { heading?: number | null; updated_at?: string }) | null;
  } | null;
  eta_seconds: number | null;
}

// §5.4
export interface Ambulance {
  id: string;
  name: string;
  plate_number: string;
  type: AmbulanceType;
  status: AmbulanceStatus;
  photo_url: string | null;
  crew: { id: string; name: string; on_duty: boolean }[];
}

// §5.5
export interface AmbulanceLocation extends LatLng {
  heading: number | null;
  updated_at: string;
}
export interface Trip {
  request_id: string;
  code: string;
  patient_name: string | null;
  called_at: string;
  ambulance: { id: string; name: string; plate_number: string } | null;
  status: RequestStatus;
  status_badge: string;
  incident_location: LatLng | null;
  ambulance_location: AmbulanceLocation | null;
}
export interface TripDetail extends Trip {
  route: (LatLng & { at: string })[];
}

// §5.6
export interface ReportItem {
  request_id: string;
  no: number;
  called_at: string;
  ambulance: { name: string; plate_number: string } | null;
  destination_address: string | null;
  patient: { identity_number: string | null; name: string | null; gender: Gender | null; age_text: string | null };
  case_type: CaseType;
}

// §5.2
export interface DashboardSummary {
  total_calls: number;
  total_cancelled: number;
}
export interface CaseTypeCount {
  code: CaseTypeCode;
  name: string;
  color: string;
  count: number;
}
export interface DailySeries {
  dates: string[];
  series: { code: CaseTypeCode; name: string; color: string; data: number[] }[];
}

// §5.7
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  request_id: string | null;
  read_at: string | null;
  created_at: string;
}
export interface NotificationMeta extends PageMeta {
  unread_count: number;
}

// §6 socket payloads
export interface AmbulanceLocationEvent {
  request_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  eta_seconds: number | null;
  updated_at: string;
}
export interface OfferWithdrawnEvent {
  request_id: string;
  reason: string;
}
