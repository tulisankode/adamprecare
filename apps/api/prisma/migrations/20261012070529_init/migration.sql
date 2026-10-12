-- Extension PostGIS (geografi FASKES & wilayah PSC 119)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'CREW', 'FACILITY_OPERATOR', 'FACILITY_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('RUMAH_SAKIT', 'KLINIK', 'PUSKESMAS', 'PSC_119');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('DASHBOARD', 'API');

-- CreateEnum
CREATE TYPE "MedicalRecordSource" AS ENUM ('MANUAL', 'SIMRS');

-- CreateEnum
CREATE TYPE "SimrsStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'FOUND', 'NOT_FOUND', 'NO_IDENTITY', 'ERROR');

-- CreateEnum
CREATE TYPE "SimrsVendor" AS ENUM ('ADAMEDS', 'MOCK');

-- CreateEnum
CREATE TYPE "SimrsAuthMode" AS ENUM ('API_KEY', 'SERVICE_ACCOUNT');

-- CreateEnum
CREATE TYPE "AmbulanceType" AS ENUM ('PASIEN', 'GAWAT_DARURAT', 'JENAZAH');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('TERSEDIA', 'BERTUGAS', 'NONAKTIF');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('TINGGI', 'NORMAL');

-- CreateEnum
CREATE TYPE "DispatchStrategy" AS ENUM ('PARALEL', 'PSC_DULU', 'BERURUTAN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('MENUNGGU', 'DITERIMA', 'DALAM_PERJALANAN', 'TIBA', 'MENUJU_FASKES', 'SAMPAI_DI_FASKES', 'SELESAI', 'DIBATALKAN', 'TIDAK_TERLAYANI');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('FASKES_MITRA', 'PSC_119');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'RESET_PASSWORD', 'VERIFY_PHONE');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('android', 'ios');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50),
    "email" VARCHAR(150),
    "phone" VARCHAR(20),
    "phone_verified_at" TIMESTAMP(3),
    "password_hash" TEXT,
    "google_sub" TEXT,
    "nik_encrypted" TEXT,
    "nik_hash" CHAR(64),
    "birth_date" DATE,
    "gender" "Gender",
    "avatar_url" TEXT,
    "facility_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "FacilityType" NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "service_area" geography(MultiPolygon, 4326),
    "phone" VARCHAR(20) NOT NULL,
    "photo_url" TEXT,
    "accepts_emergency" BOOLEAN NOT NULL DEFAULT true,
    "show_in_directory" BOOLEAN NOT NULL DEFAULT true,
    "integration_mode" "IntegrationMode" NOT NULL DEFAULT 'DASHBOARD',
    "medical_record_source" "MedicalRecordSource" NOT NULL DEFAULT 'MANUAL',
    "medical_record_format" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polyclinics" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "polyclinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_polyclinics" (
    "facility_id" UUID NOT NULL,
    "polyclinic_id" UUID NOT NULL,

    CONSTRAINT "facility_polyclinics_pkey" PRIMARY KEY ("facility_id","polyclinic_id")
);

-- CreateTable
CREATE TABLE "simrs_integrations" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "vendor" "SimrsVendor" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "external_tenant_id" TEXT,
    "auth_mode" "SimrsAuthMode" NOT NULL DEFAULT 'API_KEY',
    "credentials_encrypted" TEXT,
    "supports_patient_registration" BOOLEAN NOT NULL DEFAULT false,
    "supports_pre_arrival" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simrs_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulances" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "type" "AmbulanceType" NOT NULL,
    "photo_url" TEXT,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'TERSEDIA',
    "last_lat" DOUBLE PRECISION,
    "last_lng" DOUBLE PRECISION,
    "last_heading" DOUBLE PRECISION,
    "last_location_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_crews" (
    "user_id" UUID NOT NULL,
    "ambulance_id" UUID NOT NULL,
    "on_duty" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulance_crews_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "case_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) NOT NULL,
    "color" VARCHAR(9) NOT NULL,
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "dispatch_strategy" "DispatchStrategy" NOT NULL DEFAULT 'BERURUTAN',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "case_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "is_self" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(100),
    "name_unknown" BOOLEAN NOT NULL DEFAULT false,
    "identity_encrypted" TEXT,
    "identity_hash" CHAR(64),
    "identity_unknown" BOOLEAN NOT NULL DEFAULT false,
    "age_years" SMALLINT,
    "birth_date" DATE,
    "gender" "Gender",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_requests" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "client_request_id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "case_type_id" UUID NOT NULL,
    "case_type_other" VARCHAR(100),
    "description" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'MENUNGGU',
    "provider_type" "ProviderType",
    "facility_id" UUID,
    "ambulance_id" UUID,
    "destination_facility_id" UUID,
    "eta_seconds" INTEGER,
    "dispatch_round" INTEGER NOT NULL DEFAULT 0,
    "cancel_reason" TEXT,
    "cancelled_by" UUID,
    "escalated_at" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "departed_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3),
    "transporting_at" TIMESTAMP(3),
    "reached_facility_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "unserved_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_photos" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_status_logs" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" "RequestStatus",
    "to_status" "RequestStatus" NOT NULL,
    "actor_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_offers" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" "OfferStatus" NOT NULL DEFAULT 'OFFERED',
    "offered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "responded_by" UUID,
    "reject_reason" TEXT,

    CONSTRAINT "dispatch_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_patient_records" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "medical_record_no" VARCHAR(30),
    "source" "MedicalRecordSource" NOT NULL,
    "simrs_status" "SimrsStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "simrs_message" TEXT,
    "synced_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_patient_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_location_logs" (
    "id" BIGSERIAL NOT NULL,
    "request_id" UUID,
    "ambulance_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambulance_location_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "request_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "cover_url" TEXT,
    "excerpt" TEXT,
    "body_html" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "image_url" TEXT NOT NULL,
    "action_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active_from" TIMESTAMP(3),
    "active_until" TIMESTAMP(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "slug" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body_html" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "min_supported_version" VARCHAR(20) NOT NULL,
    "release_notes" TEXT NOT NULL,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "target" VARCHAR(150) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE INDEX "users_facility_id_idx" ON "users"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "polyclinics_name_key" ON "polyclinics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "simrs_integrations_facility_id_key" ON "simrs_integrations"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_facility_id_plate_number_key" ON "ambulances"("facility_id", "plate_number");

-- CreateIndex
CREATE INDEX "ambulance_crews_ambulance_id_idx" ON "ambulance_crews"("ambulance_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_types_code_key" ON "case_types"("code");

-- CreateIndex
CREATE INDEX "patients_owner_user_id_idx" ON "patients"("owner_user_id");

-- CreateIndex
CREATE INDEX "patients_identity_hash_idx" ON "patients"("identity_hash");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_requests_code_key" ON "emergency_requests"("code");

-- CreateIndex
CREATE INDEX "emergency_requests_status_idx" ON "emergency_requests"("status");

-- CreateIndex
CREATE INDEX "emergency_requests_facility_id_requested_at_idx" ON "emergency_requests"("facility_id", "requested_at");

-- CreateIndex
CREATE INDEX "emergency_requests_requested_at_idx" ON "emergency_requests"("requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_requests_reporter_user_id_client_request_id_key" ON "emergency_requests"("reporter_user_id", "client_request_id");

-- CreateIndex
CREATE INDEX "emergency_photos_request_id_idx" ON "emergency_photos"("request_id");

-- CreateIndex
CREATE INDEX "emergency_status_logs_request_id_created_at_idx" ON "emergency_status_logs"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "dispatch_offers_facility_id_status_idx" ON "dispatch_offers"("facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_offers_request_id_facility_id_key" ON "dispatch_offers"("request_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_patient_records_facility_id_patient_id_key" ON "facility_patient_records"("facility_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_patient_records_facility_id_medical_record_no_key" ON "facility_patient_records"("facility_id", "medical_record_no");

-- CreateIndex
CREATE INDEX "ambulance_location_logs_request_id_recorded_at_idx" ON "ambulance_location_logs"("request_id", "recorded_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "app_versions_platform_released_at_idx" ON "app_versions"("platform", "released_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_fcm_token_key" ON "devices"("fcm_token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "otp_codes_target_purpose_created_at_idx" ON "otp_codes"("target", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_polyclinics" ADD CONSTRAINT "facility_polyclinics_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_polyclinics" ADD CONSTRAINT "facility_polyclinics_polyclinic_id_fkey" FOREIGN KEY ("polyclinic_id") REFERENCES "polyclinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simrs_integrations" ADD CONSTRAINT "simrs_integrations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_crews" ADD CONSTRAINT "ambulance_crews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_crews" ADD CONSTRAINT "ambulance_crews_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_case_type_id_fkey" FOREIGN KEY ("case_type_id") REFERENCES "case_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_destination_facility_id_fkey" FOREIGN KEY ("destination_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_photos" ADD CONSTRAINT "emergency_photos_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "emergency_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_status_logs" ADD CONSTRAINT "emergency_status_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "emergency_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "emergency_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_patient_records" ADD CONSTRAINT "facility_patient_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_patient_records" ADD CONSTRAINT "facility_patient_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_location_logs" ADD CONSTRAINT "ambulance_location_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "emergency_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_location_logs" ADD CONSTRAINT "ambulance_location_logs_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Tambahan manual (tidak dapat dinyatakan di schema.prisma) =====

-- Satu permintaan SOS aktif per pelapor (desain §6.2)
CREATE UNIQUE INDEX "emergency_requests_one_active_per_reporter"
  ON "emergency_requests" ("reporter_user_id")
  WHERE "status" IN ('MENUNGGU', 'DITERIMA', 'DALAM_PERJALANAN', 'TIBA', 'MENUJU_FASKES', 'SAMPAI_DI_FASKES');

-- Index geospasial untuk pencarian FASKES terdekat & wilayah PSC 119 (desain §9.1)
CREATE INDEX "facilities_location_gix"
  ON "facilities" USING GIST ((ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography));
CREATE INDEX "facilities_service_area_gix"
  ON "facilities" USING GIST ("service_area");
