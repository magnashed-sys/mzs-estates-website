
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

type Settings = {
  nightly_rate_eur: number;
  minimum_nights: number;
  maximum_guests: number;
  flexible_arrival: boolean;
  pool_heating_available: boolean;
  pool_heating_surcharge_eur: number | null;
};

type BlockedPeriod = {
  check_in: string;
  check_out: string;
};

type CalendarData = {
  settings: Settings;
  unavailable: BlockedPeriod[];
};

type Props = {
  projectId: string;
};

const gold = "#d5c09a";
const muted = "#aaa59b";
const border = "#403a30";

function toDate(value: string) {
  return
