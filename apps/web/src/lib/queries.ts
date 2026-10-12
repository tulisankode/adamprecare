"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, getData, getPage, postData, putData } from "./api";
import { useFallbackPolling } from "./socket";
import { dismissOfferToast } from "./toasts";
import type {
  Ambulance,
  AmbulanceType,
  AppNotification,
  CaseType,
  CaseTypeCount,
  DailySeries,
  DashboardSummary,
  NotificationMeta,
  OperatorRequest,
  OperatorRequestDetail,
  ReportItem,
  Trip,
  TripDetail,
} from "./types";

export const qk = {
  caseTypes: ["case-types"] as const,
  dashboard: (kind: string, from: string, to: string) => ["dashboard", kind, from, to] as const,
  requests: (f: RequestFilters) => ["requests", f] as const,
  request: (id: string) => ["request", id] as const,
  ambulances: (type: string) => ["ambulances", "TERSEDIA", type] as const,
  trips: (f: TripFilters) => ["trips", f] as const,
  trip: (id: string) => ["trip", id] as const,
  reports: (f: ReportFilters) => ["reports", f] as const,
  notifications: ["notifications"] as const,
};

export interface DateRange {
  from: string;
  to: string;
}

export function useCaseTypes() {
  return useQuery({
    queryKey: qk.caseTypes,
    queryFn: () => getData<CaseType[]>("/case-types"),
    staleTime: 60 * 60 * 1000,
  });
}

/* Dashboard (§5.2) */
export function useDashboardSummary({ from, to }: DateRange) {
  return useQuery({
    queryKey: qk.dashboard("summary", from, to),
    queryFn: () => getData<DashboardSummary>("/operator/dashboard/summary", { from, to }),
  });
}
export function useDashboardByCaseType({ from, to }: DateRange) {
  return useQuery({
    queryKey: qk.dashboard("by-case-type", from, to),
    queryFn: () => getData<CaseTypeCount[]>("/operator/dashboard/by-case-type", { from, to }),
  });
}
export function useDashboardDaily({ from, to }: DateRange) {
  return useQuery({
    queryKey: qk.dashboard("daily", from, to),
    queryFn: () => getData<DailySeries>("/operator/dashboard/daily", { from, to }),
  });
}

/* Data Kasus Masuk (§5.3) */
export interface RequestFilters {
  q: string;
  case_type: string;
  status: string;
  from: string;
  to: string;
  page: number;
  per_page: number;
}

export function useRequests(filters: RequestFilters) {
  const poll = useFallbackPolling();
  return useQuery({
    queryKey: qk.requests(filters),
    queryFn: () => getPage<OperatorRequest>("/operator/requests", { ...filters }),
    placeholderData: keepPreviousData,
    refetchInterval: poll,
  });
}

export function useRequestDetail(id: string | null) {
  const poll = useFallbackPolling();
  return useQuery({
    queryKey: qk.request(id ?? ""),
    queryFn: () => getData<OperatorRequestDetail>(`/operator/requests/${id}`),
    enabled: !!id,
    // Photo URLs are signed for 5 minutes (§7).
    staleTime: 60 * 1000,
    refetchInterval: poll,
  });
}

export function useAvailableAmbulances(type: AmbulanceType | "", enabled = true) {
  return useQuery({
    queryKey: qk.ambulances(type),
    queryFn: () => getData<Ambulance[]>("/operator/ambulances", { status: "TERSEDIA", type }),
    enabled: enabled && !!type,
  });
}

function useInvalidateCases() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["trips"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["ambulances"] });
    if (id) qc.invalidateQueries({ queryKey: qk.request(id) });
  };
}

export function useAcceptRequest() {
  const invalidate = useInvalidateCases();
  return useMutation({
    mutationFn: ({ id, ambulance_id }: { id: string; ambulance_id: string }) =>
      postData<OperatorRequest>(`/operator/requests/${id}/accept`, { ambulance_id }),
    onSuccess: (_d, v) => dismissOfferToast(v.id),
    onError: (err, v) => {
      // ALREADY_TAKEN / INVALID_STATUS_TRANSITION: the offer is gone either way.
      if (err instanceof ApiError && err.status === 409) dismissOfferToast(v.id);
    },
    onSettled: (_d, _e, v) => invalidate(v.id),
  });
}

export function useRejectRequest() {
  const invalidate = useInvalidateCases();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      postData<{ success: boolean }>(`/operator/requests/${id}/reject`, { reason }),
    onSuccess: (_d, v) => dismissOfferToast(v.id),
    onSettled: (_d, _e, v) => invalidate(v.id),
  });
}

export function useUpdateMedicalRecord() {
  const invalidate = useInvalidateCases();
  return useMutation({
    mutationFn: ({ id, medical_record_no }: { id: string; medical_record_no: string }) =>
      putData<OperatorRequest>(`/operator/requests/${id}/medical-record`, { medical_record_no }),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}

export function useSyncMedicalRecord() {
  const invalidate = useInvalidateCases();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => postData<OperatorRequest>(`/operator/requests/${id}/medical-record/sync`),
    onSettled: (_d, _e, v) => invalidate(v.id),
  });
}

/* Tracking (§5.5) */
export interface TripFilters {
  q: string;
  status: string;
  from: string;
  to: string;
  page: number;
  per_page: number;
}

export function useTrips(filters: TripFilters) {
  const poll = useFallbackPolling();
  return useQuery({
    queryKey: qk.trips(filters),
    queryFn: () => getPage<Trip>("/operator/trips", { ...filters }),
    placeholderData: keepPreviousData,
    refetchInterval: poll,
  });
}

export function useTripDetail(id: string | null) {
  const poll = useFallbackPolling();
  return useQuery({
    queryKey: qk.trip(id ?? ""),
    queryFn: () => getData<TripDetail>(`/operator/trips/${id}`),
    enabled: !!id,
    refetchInterval: poll,
  });
}

/* Laporan (§5.6) */
export interface ReportFilters {
  patient_name: string;
  case_type: string;
  from: string;
  to: string;
  page: number;
  per_page: number;
}

export function useReports(filters: ReportFilters) {
  return useQuery({
    queryKey: qk.reports(filters),
    queryFn: () => getPage<ReportItem>("/operator/reports", { ...filters }),
    placeholderData: keepPreviousData,
  });
}

/* Notifikasi (§5.7) */
export function useNotifications() {
  const poll = useFallbackPolling(30_000);
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => getPage<AppNotification, NotificationMeta>("/operator/notifications", { page: 1, per_page: 15 }),
    refetchInterval: poll,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      postData<{ success: boolean }>("/operator/notifications/read", ids && ids.length ? { ids } : {}),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}
