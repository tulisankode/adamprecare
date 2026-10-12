-- Satu orang dapat tercatat sebagai beberapa baris pasien (dilaporkan oleh pengguna berbeda)
-- dan sah memakai No. RM yang sama di satu FASKES → index tidak lagi unik.
DROP INDEX "facility_patient_records_facility_id_medical_record_no_key";

CREATE INDEX "facility_patient_records_facility_id_medical_record_no_idx" ON "facility_patient_records"("facility_id", "medical_record_no");
