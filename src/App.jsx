import React, { useState, useMemo } from "react";
import {
  LayoutGrid, Users, ClipboardCheck, Stethoscope, BookOpen, Plus, Search, X, Check,
  ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Pencil, Paperclip, Link2,
  CircleCheck, AlertTriangle, MessageSquare, CornerUpLeft, Trash2, Activity, Wallet,
  FileText, TrendingDown, LogOut, Printer, History, Filter, Phone, Bell, Settings, MoreHorizontal
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "./lib/useAuth";
import { useDataStore } from "./lib/useDataStore";
import Login from "./components/Login";

/* ============================================================================
   Go Doc — Operations System (single-file prototype)
   Admin + Doctor · intake · ICD diagnosis · exercises + modalities · review ·
   doctor management · seamless assessment→follow-up carry-forward · billing
   isolated from doctors. Flip the role switch up top to see data connect.
   ============================================================================ */

const C = { bg:"#ECECEA", ink:"#1E2A3A", ink2:"#2E3440", teal:"#7DD8DF", tealSoft:"#9BD5DD",
  line:"#DCDCD8", grey:"#8794A1", amber:"#E0A458", green:"#3FA796", red:"#C0392B" };

/* ICD-10-CM source: scraped from icd10data.com (M+G+S chapters), inlined here as a
   const so the single-file prototype runs in the artifact renderer (no filesystem).
   To refresh: run scrape_icd.py and replace the array below — same shape, the
   keys are compacted to c/l to keep this block readable. */
const ICD_SEED_RAW = [
  {c:"G20.A1",l:"Parkinson's disease without dyskinesia, without mention of fluctuations"},
  {c:"G20.A2",l:"Parkinson's disease without dyskinesia, with fluctuations"},
  {c:"G20.B1",l:"Parkinson's disease with dyskinesia, without mention of fluctuations"},
  {c:"G20.B2",l:"Parkinson's disease with dyskinesia, with fluctuations"},
  {c:"G24.1",l:"Genetic torsion dystonia"},
  {c:"G25.0",l:"Essential tremor"},
  {c:"G35",l:"Multiple sclerosis"},
  {c:"G50.0",l:"Trigeminal neuralgia"},
  {c:"G51.0",l:"Bell's palsy"},
  {c:"G54.0",l:"Brachial plexus disorders"},
  {c:"G54.1",l:"Lumbosacral plexus disorders"},
  {c:"G56.00",l:"Carpal tunnel syndrome, unspecified upper limb"},
  {c:"G56.01",l:"Carpal tunnel syndrome, right upper limb"},
  {c:"G56.02",l:"Carpal tunnel syndrome, left upper limb"},
  {c:"G56.03",l:"Carpal tunnel syndrome, bilateral upper limbs"},
  {c:"G57.10",l:"Meralgia paresthetica, unspecified lower limb"},
  {c:"G57.30",l:"Lesion of lateral popliteal nerve, unspecified lower limb"},
  {c:"G57.50",l:"Tarsal tunnel syndrome, unspecified lower limb"},
  {c:"G57.51",l:"Tarsal tunnel syndrome, right lower limb"},
  {c:"G57.52",l:"Tarsal tunnel syndrome, left lower limb"},
  {c:"G57.53",l:"Tarsal tunnel syndrome, bilateral lower limbs"},
  {c:"G80.0",l:"Spastic quadriplegic cerebral palsy"},
  {c:"G80.1",l:"Spastic diplegic cerebral palsy"},
  {c:"G80.2",l:"Spastic hemiplegic cerebral palsy"},
  {c:"G81.10",l:"Spastic hemiplegia affecting unspecified side"},
  {c:"G81.11",l:"Spastic hemiplegia affecting right dominant side"},
  {c:"G81.12",l:"Spastic hemiplegia affecting left dominant side"},
  {c:"G81.13",l:"Spastic hemiplegia affecting right nondominant side"},
  {c:"G81.14",l:"Spastic hemiplegia affecting left nondominant side"},
  {c:"G82.20",l:"Paraplegia, unspecified"},
  {c:"G83.4",l:"Cauda equina syndrome"},
  {c:"G89.21",l:"Chronic pain due to trauma"},
  {c:"G89.29",l:"Other chronic pain"},
  {c:"G89.4",l:"Chronic pain syndrome"},
  {c:"G90.50",l:"Complex regional pain syndrome I, unspecified"},
  {c:"M15.0",l:"Primary generalized (osteo)arthritis"},
  {c:"M16.10",l:"Unilateral primary osteoarthritis, unspecified hip"},
  {c:"M16.11",l:"Unilateral primary osteoarthritis, right hip"},
  {c:"M16.12",l:"Unilateral primary osteoarthritis, left hip"},
  {c:"M17.0",l:"Bilateral primary osteoarthritis of knee"},
  {c:"M17.10",l:"Unilateral primary osteoarthritis, unspecified knee"},
  {c:"M17.11",l:"Unilateral primary osteoarthritis, right knee"},
  {c:"M17.12",l:"Unilateral primary osteoarthritis, left knee"},
  {c:"M17.9",l:"Osteoarthritis of knee, unspecified"},
  {c:"M19.91",l:"Primary osteoarthritis, unspecified site"},
  {c:"M22.2X1",l:"Patellofemoral disorders, right knee"},
  {c:"M22.2X2",l:"Patellofemoral disorders, left knee"},
  {c:"M23.30",l:"Other meniscus derangements, unspecified meniscus, unspecified knee"},
  {c:"M24.561",l:"Contracture, right knee"},
  {c:"M25.511",l:"Pain in right shoulder"},
  {c:"M25.512",l:"Pain in left shoulder"},
  {c:"M25.551",l:"Pain in right hip"},
  {c:"M25.552",l:"Pain in left hip"},
  {c:"M25.561",l:"Pain in right knee"},
  {c:"M25.562",l:"Pain in left knee"},
  {c:"M25.571",l:"Pain in right ankle and joints of right foot"},
  {c:"M25.572",l:"Pain in left ankle and joints of left foot"},
  {c:"M40.00",l:"Postural kyphosis, site unspecified"},
  {c:"M41.9",l:"Scoliosis, unspecified"},
  {c:"M43.6",l:"Torticollis"},
  {c:"M47.812",l:"Spondylosis without myelopathy or radiculopathy, cervical region"},
  {c:"M47.816",l:"Spondylosis without myelopathy or radiculopathy, lumbar region"},
  {c:"M48.06",l:"Spinal stenosis, lumbar region"},
  {c:"M50.20",l:"Other cervical disc displacement, unspecified cervical region"},
  {c:"M51.26",l:"Other intervertebral disc displacement, lumbar region"},
  {c:"M51.36",l:"Other intervertebral disc degeneration, lumbar region"},
  {c:"M53.1",l:"Cervicobrachial syndrome"},
  {c:"M54.10",l:"Radiculopathy, site unspecified"},
  {c:"M54.12",l:"Radiculopathy, cervical region"},
  {c:"M54.16",l:"Radiculopathy, lumbar region"},
  {c:"M54.2",l:"Cervicalgia"},
  {c:"M54.30",l:"Sciatica, unspecified side"},
  {c:"M54.40",l:"Lumbago with sciatica, unspecified side"},
  {c:"M54.50",l:"Low back pain, unspecified"},
  {c:"M54.51",l:"Vertebrogenic low back pain"},
  {c:"M54.59",l:"Other low back pain"},
  {c:"M54.6",l:"Pain in thoracic spine"},
  {c:"M54.81",l:"Occipital neuralgia"},
  {c:"M54.89",l:"Other dorsalgia"},
  {c:"M54.9",l:"Dorsalgia, unspecified"},
  {c:"M62.830",l:"Muscle spasm of back"},
  {c:"M62.838",l:"Other muscle spasm"},
  {c:"M70.0",l:"Crepitant synovitis (acute) (chronic) of hand and wrist"},
  {c:"M70.03",l:"Crepitant synovitis (acute) (chronic), wrist"},
  {c:"M70.031",l:"Crepitant synovitis (acute) (chronic), right wrist"},
  {c:"M70.032",l:"Crepitant synovitis (acute) (chronic), left wrist"},
  {c:"M70.039",l:"Crepitant synovitis (acute) (chronic), unspecified wrist"},
  {c:"M70.04",l:"Crepitant synovitis (acute) (chronic), hand"},
  {c:"M70.041",l:"Crepitant synovitis (acute) (chronic), right hand"},
  {c:"M70.042",l:"Crepitant synovitis (acute) (chronic), left hand"},
  {c:"M70.049",l:"Crepitant synovitis (acute) (chronic), unspecified hand"},
  {c:"M70.1",l:"Bursitis of hand"},
  {c:"M70.10",l:"Bursitis, unspecified hand"},
  {c:"M70.11",l:"Bursitis, right hand"},
  {c:"M70.12",l:"Bursitis, left hand"},
  {c:"M70.2",l:"Olecranon bursitis"},
  {c:"M70.20",l:"Olecranon bursitis, unspecified elbow"},
  {c:"M70.21",l:"Olecranon bursitis, right elbow"},
  {c:"M70.22",l:"Olecranon bursitis, left elbow"},
  {c:"M70.3",l:"Other bursitis of elbow"},
  {c:"M70.30",l:"Other bursitis of elbow, unspecified elbow"},
  {c:"M70.31",l:"Other bursitis of elbow, right elbow"},
  {c:"M70.32",l:"Other bursitis of elbow, left elbow"},
  {c:"M70.4",l:"Prepatellar bursitis"},
  {c:"M70.40",l:"Prepatellar bursitis, unspecified knee"},
  {c:"M70.41",l:"Prepatellar bursitis, right knee"},
  {c:"M70.42",l:"Prepatellar bursitis, left knee"},
  {c:"M70.5",l:"Other bursitis of knee"},
  {c:"M70.50",l:"Other bursitis of knee, unspecified knee"},
  {c:"M70.51",l:"Other bursitis of knee, right knee"},
  {c:"M70.52",l:"Other bursitis of knee, left knee"},
  {c:"M70.6",l:"Trochanteric bursitis"},
  {c:"M70.60",l:"Trochanteric bursitis, unspecified hip"},
  {c:"M70.61",l:"Trochanteric bursitis, right hip"},
  {c:"M70.62",l:"Trochanteric bursitis, left hip"},
  {c:"M70.7",l:"Other bursitis of hip"},
  {c:"M70.70",l:"Other bursitis of hip, unspecified hip"},
  {c:"M70.71",l:"Other bursitis of hip, right hip"},
  {c:"M70.72",l:"Other bursitis of hip, left hip"},
  {c:"M70.8",l:"Other soft tissue disorders related to use, overuse and pressure"},
  {c:"M70.80",l:"Other soft tissue disorders related to use, overuse and pressure of unspecified site"},
  {c:"M70.81",l:"Other soft tissue disorders related to use, overuse and pressure of shoulder"},
  {c:"M70.811",l:"Other soft tissue disorders related to use, overuse and pressure, right shoulder"},
  {c:"M70.812",l:"Other soft tissue disorders related to use, overuse and pressure, left shoulder"},
  {c:"M70.819",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified shoulder"},
  {c:"M70.82",l:"Other soft tissue disorders related to use, overuse and pressure of upper arm"},
  {c:"M70.821",l:"Other soft tissue disorders related to use, overuse and pressure, right upper arm"},
  {c:"M70.822",l:"Other soft tissue disorders related to use, overuse and pressure, left upper arm"},
  {c:"M70.829",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified upper arms"},
  {c:"M70.83",l:"Other soft tissue disorders related to use, overuse and pressure of forearm"},
  {c:"M70.831",l:"Other soft tissue disorders related to use, overuse and pressure, right forearm"},
  {c:"M70.832",l:"Other soft tissue disorders related to use, overuse and pressure, left forearm"},
  {c:"M70.839",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified forearm"},
  {c:"M70.84",l:"Other soft tissue disorders related to use, overuse and pressure of hand"},
  {c:"M70.841",l:"Other soft tissue disorders related to use, overuse and pressure, right hand"},
  {c:"M70.842",l:"Other soft tissue disorders related to use, overuse and pressure, left hand"},
  {c:"M70.849",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified hand"},
  {c:"M70.85",l:"Other soft tissue disorders related to use, overuse and pressure of thigh"},
  {c:"M70.851",l:"Other soft tissue disorders related to use, overuse and pressure, right thigh"},
  {c:"M70.852",l:"Other soft tissue disorders related to use, overuse and pressure, left thigh"},
  {c:"M70.859",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified thigh"},
  {c:"M70.86",l:"Other soft tissue disorders related to use, overuse and pressure lower leg"},
  {c:"M70.861",l:"Other soft tissue disorders related to use, overuse and pressure, right lower leg"},
  {c:"M70.862",l:"Other soft tissue disorders related to use, overuse and pressure, left lower leg"},
  {c:"M70.869",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified leg"},
  {c:"M70.87",l:"Other soft tissue disorders related to use, overuse and pressure of ankle and foot"},
  {c:"M70.871",l:"Other soft tissue disorders related to use, overuse and pressure, right ankle and foot"},
  {c:"M70.872",l:"Other soft tissue disorders related to use, overuse and pressure, left ankle and foot"},
  {c:"M70.879",l:"Other soft tissue disorders related to use, overuse and pressure, unspecified ankle and foot"},
  {c:"M70.88",l:"Other soft tissue disorders related to use, overuse and pressure other site"},
  {c:"M70.89",l:"Other soft tissue disorders related to use, overuse and pressure multiple sites"},
  {c:"M70.9",l:"Unspecified soft tissue disorder related to use, overuse and pressure"},
  {c:"M70.90",l:"Unspecified soft tissue disorder related to use, overuse and pressure of unspecified site"},
  {c:"M70.91",l:"Unspecified soft tissue disorder related to use, overuse and pressure of shoulder"},
  {c:"M70.911",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right shoulder"},
  {c:"M70.912",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left shoulder"},
  {c:"M70.919",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified shoulder"},
  {c:"M70.92",l:"Unspecified soft tissue disorder related to use, overuse and pressure of upper arm"},
  {c:"M70.921",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right upper arm"},
  {c:"M70.922",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left upper arm"},
  {c:"M70.929",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified upper arm"},
  {c:"M70.93",l:"Unspecified soft tissue disorder related to use, overuse and pressure of forearm"},
  {c:"M70.931",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right forearm"},
  {c:"M70.932",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left forearm"},
  {c:"M70.939",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified forearm"},
  {c:"M70.94",l:"Unspecified soft tissue disorder related to use, overuse and pressure of hand"},
  {c:"M70.941",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right hand"},
  {c:"M70.942",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left hand"},
  {c:"M70.949",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified hand"},
  {c:"M70.95",l:"Unspecified soft tissue disorder related to use, overuse and pressure of thigh"},
  {c:"M70.951",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right thigh"},
  {c:"M70.952",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left thigh"},
  {c:"M70.959",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified thigh"},
  {c:"M70.96",l:"Unspecified soft tissue disorder related to use, overuse and pressure lower leg"},
  {c:"M70.961",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right lower leg"},
  {c:"M70.962",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left lower leg"},
  {c:"M70.969",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified lower leg"},
  {c:"M70.97",l:"Unspecified soft tissue disorder related to use, overuse and pressure of ankle and foot"},
  {c:"M70.971",l:"Unspecified soft tissue disorder related to use, overuse and pressure, right ankle and foot"},
  {c:"M70.972",l:"Unspecified soft tissue disorder related to use, overuse and pressure, left ankle and foot"},
  {c:"M70.979",l:"Unspecified soft tissue disorder related to use, overuse and pressure, unspecified ankle and foot"},
  {c:"M70.98",l:"Unspecified soft tissue disorder related to use, overuse and pressure other"},
  {c:"M70.99",l:"Unspecified soft tissue disorder related to use, overuse and pressure multiple sites"},
  {c:"M71.0",l:"Abscess of bursa"},
  {c:"M71.00",l:"Abscess of bursa, unspecified site"},
  {c:"M71.01",l:"Abscess of bursa, shoulder"},
  {c:"M71.011",l:"Abscess of bursa, right shoulder"},
  {c:"M71.012",l:"Abscess of bursa, left shoulder"},
  {c:"M71.019",l:"Abscess of bursa, unspecified shoulder"},
  {c:"M71.02",l:"Abscess of bursa, elbow"},
  {c:"M71.021",l:"Abscess of bursa, right elbow"},
  {c:"M71.022",l:"Abscess of bursa, left elbow"},
  {c:"M71.029",l:"Abscess of bursa, unspecified elbow"},
  {c:"M71.03",l:"Abscess of bursa, wrist"},
  {c:"M71.031",l:"Abscess of bursa, right wrist"},
  {c:"M71.032",l:"Abscess of bursa, left wrist"},
  {c:"M71.039",l:"Abscess of bursa, unspecified wrist"},
  {c:"M71.04",l:"Abscess of bursa, hand"},
  {c:"M71.041",l:"Abscess of bursa, right hand"},
  {c:"M71.042",l:"Abscess of bursa, left hand"},
  {c:"M71.049",l:"Abscess of bursa, unspecified hand"},
  {c:"M71.05",l:"Abscess of bursa, hip"},
  {c:"M71.051",l:"Abscess of bursa, right hip"},
  {c:"M71.052",l:"Abscess of bursa, left hip"},
  {c:"M71.059",l:"Abscess of bursa, unspecified hip"},
  {c:"M71.06",l:"Abscess of bursa, knee"},
  {c:"M71.061",l:"Abscess of bursa, right knee"},
  {c:"M71.062",l:"Abscess of bursa, left knee"},
  {c:"M71.069",l:"Abscess of bursa, unspecified knee"},
  {c:"M71.07",l:"Abscess of bursa, ankle and foot"},
  {c:"M71.071",l:"Abscess of bursa, right ankle and foot"},
  {c:"M71.072",l:"Abscess of bursa, left ankle and foot"},
  {c:"M71.079",l:"Abscess of bursa, unspecified ankle and foot"},
  {c:"M71.08",l:"Abscess of bursa, other site"},
  {c:"M71.09",l:"Abscess of bursa, multiple sites"},
  {c:"M71.1",l:"Other infective bursitis"},
  {c:"M71.10",l:"Other infective bursitis, unspecified site"},
  {c:"M71.11",l:"Other infective bursitis, shoulder"},
  {c:"M71.111",l:"Other infective bursitis, right shoulder"},
  {c:"M71.112",l:"Other infective bursitis, left shoulder"},
  {c:"M71.119",l:"Other infective bursitis, unspecified shoulder"},
  {c:"M71.12",l:"Other infective bursitis, elbow"},
  {c:"M71.121",l:"Other infective bursitis, right elbow"},
  {c:"M71.122",l:"Other infective bursitis, left elbow"},
  {c:"M71.129",l:"Other infective bursitis, unspecified elbow"},
  {c:"M71.13",l:"Other infective bursitis, wrist"},
  {c:"M71.131",l:"Other infective bursitis, right wrist"},
  {c:"M71.132",l:"Other infective bursitis, left wrist"},
  {c:"M71.139",l:"Other infective bursitis, unspecified wrist"},
  {c:"M71.14",l:"Other infective bursitis, hand"},
  {c:"M71.141",l:"Other infective bursitis, right hand"},
  {c:"M71.142",l:"Other infective bursitis, left hand"},
  {c:"M71.149",l:"Other infective bursitis, unspecified hand"},
  {c:"M71.15",l:"Other infective bursitis, hip"},
  {c:"M71.151",l:"Other infective bursitis, right hip"},
  {c:"M71.152",l:"Other infective bursitis, left hip"},
  {c:"M71.159",l:"Other infective bursitis, unspecified hip"},
  {c:"M71.16",l:"Other infective bursitis, knee"},
  {c:"M71.161",l:"Other infective bursitis, right knee"},
  {c:"M71.162",l:"Other infective bursitis, left knee"},
  {c:"M71.169",l:"Other infective bursitis, unspecified knee"},
  {c:"M71.17",l:"Other infective bursitis, ankle and foot"},
  {c:"M71.171",l:"Other infective bursitis, right ankle and foot"},
  {c:"M71.172",l:"Other infective bursitis, left ankle and foot"},
  {c:"M71.179",l:"Other infective bursitis, unspecified ankle and foot"},
  {c:"M71.18",l:"Other infective bursitis, other site"},
  {c:"M71.19",l:"Other infective bursitis, multiple sites"},
  {c:"M71.2",l:"Synovial cyst of popliteal space [Baker]"},
  {c:"M71.20",l:"Synovial cyst of popliteal space [Baker], unspecified knee"},
  {c:"M71.21",l:"Synovial cyst of popliteal space [Baker], right knee"},
  {c:"M71.22",l:"Synovial cyst of popliteal space [Baker], left knee"},
  {c:"M71.3",l:"Other bursal cyst"},
  {c:"M71.30",l:"Other bursal cyst, unspecified site"},
  {c:"M71.31",l:"Other bursal cyst, shoulder"},
  {c:"M71.311",l:"Other bursal cyst, right shoulder"},
  {c:"M71.312",l:"Other bursal cyst, left shoulder"},
  {c:"M71.319",l:"Other bursal cyst, unspecified shoulder"},
  {c:"M71.32",l:"Other bursal cyst, elbow"},
  {c:"M71.321",l:"Other bursal cyst, right elbow"},
  {c:"M71.322",l:"Other bursal cyst, left elbow"},
  {c:"M71.329",l:"Other bursal cyst, unspecified elbow"},
  {c:"M71.33",l:"Other bursal cyst, wrist"},
  {c:"M71.331",l:"Other bursal cyst, right wrist"},
  {c:"M71.332",l:"Other bursal cyst, left wrist"},
  {c:"M71.339",l:"Other bursal cyst, unspecified wrist"},
  {c:"M71.34",l:"Other bursal cyst, hand"},
  {c:"M71.341",l:"Other bursal cyst, right hand"},
  {c:"M71.342",l:"Other bursal cyst, left hand"},
  {c:"M71.349",l:"Other bursal cyst, unspecified hand"},
  {c:"M71.35",l:"Other bursal cyst, hip"},
  {c:"M71.351",l:"Other bursal cyst, right hip"},
  {c:"M71.352",l:"Other bursal cyst, left hip"},
  {c:"M71.359",l:"Other bursal cyst, unspecified hip"},
  {c:"M71.37",l:"Other bursal cyst, ankle and foot"},
  {c:"M71.371",l:"Other bursal cyst, right ankle and foot"},
  {c:"M71.372",l:"Other bursal cyst, left ankle and foot"},
  {c:"M71.379",l:"Other bursal cyst, unspecified ankle and foot"},
  {c:"M71.38",l:"Other bursal cyst, other site"},
  {c:"M71.39",l:"Other bursal cyst, multiple sites"},
  {c:"M71.4",l:"Calcium deposit in bursa"},
  {c:"M71.40",l:"Calcium deposit in bursa, unspecified site"},
  {c:"M71.42",l:"Calcium deposit in bursa, elbow"},
  {c:"M71.421",l:"Calcium deposit in bursa, right elbow"},
  {c:"M71.422",l:"Calcium deposit in bursa, left elbow"},
  {c:"M71.429",l:"Calcium deposit in bursa, unspecified elbow"},
  {c:"M71.43",l:"Calcium deposit in bursa, wrist"},
  {c:"M71.431",l:"Calcium deposit in bursa, right wrist"},
  {c:"M71.432",l:"Calcium deposit in bursa, left wrist"},
  {c:"M71.439",l:"Calcium deposit in bursa, unspecified wrist"},
  {c:"M71.44",l:"Calcium deposit in bursa, hand"},
  {c:"M71.441",l:"Calcium deposit in bursa, right hand"},
  {c:"M71.442",l:"Calcium deposit in bursa, left hand"},
  {c:"M71.449",l:"Calcium deposit in bursa, unspecified hand"},
  {c:"M71.45",l:"Calcium deposit in bursa, hip"},
  {c:"M71.451",l:"Calcium deposit in bursa, right hip"},
  {c:"M71.452",l:"Calcium deposit in bursa, left hip"},
  {c:"M71.459",l:"Calcium deposit in bursa, unspecified hip"},
  {c:"M71.46",l:"Calcium deposit in bursa, knee"},
  {c:"M71.461",l:"Calcium deposit in bursa, right knee"},
  {c:"M71.462",l:"Calcium deposit in bursa, left knee"},
  {c:"M71.469",l:"Calcium deposit in bursa, unspecified knee"},
  {c:"M71.47",l:"Calcium deposit in bursa, ankle and foot"},
  {c:"M71.471",l:"Calcium deposit in bursa, right ankle and foot"},
  {c:"M71.472",l:"Calcium deposit in bursa, left ankle and foot"},
  {c:"M71.479",l:"Calcium deposit in bursa, unspecified ankle and foot"},
  {c:"M71.48",l:"Calcium deposit in bursa, other site"},
  {c:"M71.49",l:"Calcium deposit in bursa, multiple sites"},
  {c:"M71.5",l:"Other bursitis, not elsewhere classified"},
  {c:"M71.50",l:"Other bursitis, not elsewhere classified, unspecified site"},
  {c:"M71.52",l:"Other bursitis, not elsewhere classified, elbow"},
  {c:"M71.521",l:"Other bursitis, not elsewhere classified, right elbow"},
  {c:"M71.522",l:"Other bursitis, not elsewhere classified, left elbow"},
  {c:"M71.529",l:"Other bursitis, not elsewhere classified, unspecified elbow"},
  {c:"M71.53",l:"Other bursitis, not elsewhere classified, wrist"},
  {c:"M71.531",l:"Other bursitis, not elsewhere classified, right wrist"},
  {c:"M71.532",l:"Other bursitis, not elsewhere classified, left wrist"},
  {c:"M71.539",l:"Other bursitis, not elsewhere classified, unspecified wrist"},
  {c:"M71.54",l:"Other bursitis, not elsewhere classified, hand"},
  {c:"M71.541",l:"Other bursitis, not elsewhere classified, right hand"},
  {c:"M71.542",l:"Other bursitis, not elsewhere classified, left hand"},
  {c:"M71.549",l:"Other bursitis, not elsewhere classified, unspecified hand"},
  {c:"M71.55",l:"Other bursitis, not elsewhere classified, hip"},
  {c:"M71.551",l:"Other bursitis, not elsewhere classified, right hip"},
  {c:"M71.552",l:"Other bursitis, not elsewhere classified, left hip"},
  {c:"M71.559",l:"Other bursitis, not elsewhere classified, unspecified hip"},
  {c:"M71.56",l:"Other bursitis, not elsewhere classified, knee"},
  {c:"M71.561",l:"Other bursitis, not elsewhere classified, right knee"},
  {c:"M71.562",l:"Other bursitis, not elsewhere classified, left knee"},
  {c:"M71.569",l:"Other bursitis, not elsewhere classified, unspecified knee"},
  {c:"M71.57",l:"Other bursitis, not elsewhere classified, ankle and foot"},
  {c:"M71.571",l:"Other bursitis, not elsewhere classified, right ankle and foot"},
  {c:"M71.572",l:"Other bursitis, not elsewhere classified, left ankle and foot"},
  {c:"M71.579",l:"Other bursitis, not elsewhere classified, unspecified ankle and foot"},
  {c:"M71.58",l:"Other bursitis, not elsewhere classified, other site"},
  {c:"M71.8",l:"Other specified bursopathies"},
  {c:"M71.80",l:"Other specified bursopathies, unspecified site"},
  {c:"M71.81",l:"Other specified bursopathies, shoulder"},
  {c:"M71.811",l:"Other specified bursopathies, right shoulder"},
  {c:"M71.812",l:"Other specified bursopathies, left shoulder"},
  {c:"M71.819",l:"Other specified bursopathies, unspecified shoulder"},
  {c:"M71.82",l:"Other specified bursopathies, elbow"},
  {c:"M71.821",l:"Other specified bursopathies, right elbow"},
  {c:"M71.822",l:"Other specified bursopathies, left elbow"},
  {c:"M71.829",l:"Other specified bursopathies, unspecified elbow"},
  {c:"M71.83",l:"Other specified bursopathies, wrist"},
  {c:"M71.831",l:"Other specified bursopathies, right wrist"},
  {c:"M71.832",l:"Other specified bursopathies, left wrist"},
  {c:"M71.839",l:"Other specified bursopathies, unspecified wrist"},
  {c:"M71.84",l:"Other specified bursopathies, hand"},
  {c:"M71.841",l:"Other specified bursopathies, right hand"},
  {c:"M71.842",l:"Other specified bursopathies, left hand"},
  {c:"M71.849",l:"Other specified bursopathies, unspecified hand"},
  {c:"M71.85",l:"Other specified bursopathies, hip"},
  {c:"M71.851",l:"Other specified bursopathies, right hip"},
  {c:"M71.852",l:"Other specified bursopathies, left hip"},
  {c:"M71.859",l:"Other specified bursopathies, unspecified hip"},
  {c:"M71.86",l:"Other specified bursopathies, knee"},
  {c:"M71.861",l:"Other specified bursopathies, right knee"},
  {c:"M71.862",l:"Other specified bursopathies, left knee"},
  {c:"M71.869",l:"Other specified bursopathies, unspecified knee"},
  {c:"M71.87",l:"Other specified bursopathies, ankle and foot"},
  {c:"M71.871",l:"Other specified bursopathies, right ankle and foot"},
  {c:"M71.872",l:"Other specified bursopathies, left ankle and foot"},
  {c:"M71.879",l:"Other specified bursopathies, unspecified ankle and foot"},
  {c:"M71.88",l:"Other specified bursopathies, other site"},
  {c:"M71.89",l:"Other specified bursopathies, multiple sites"},
  {c:"M71.9",l:"Bursopathy, unspecified"},
  {c:"M72.0",l:"Palmar fascial fibromatosis [Dupuytren]"},
  {c:"M72.1",l:"Knuckle pads"},
  {c:"M72.2",l:"Plantar fascial fibromatosis"},
  {c:"M72.4",l:"Pseudosarcomatous fibromatosis"},
  {c:"M72.6",l:"Necrotizing fasciitis"},
  {c:"M72.8",l:"Other fibroblastic disorders"},
  {c:"M72.9",l:"Fibroblastic disorder, unspecified"},
  {c:"M75.0",l:"Adhesive capsulitis of shoulder"},
  {c:"M75.00",l:"Adhesive capsulitis of unspecified shoulder"},
  {c:"M75.01",l:"Adhesive capsulitis of right shoulder"},
  {c:"M75.02",l:"Adhesive capsulitis of left shoulder"},
  {c:"M75.1",l:"Rotator cuff tear or rupture, not specified as traumatic"},
  {c:"M75.10",l:"Unspecified rotator cuff tear or rupture, not specified as traumatic"},
  {c:"M75.100",l:"Unspecified rotator cuff tear or rupture of unspecified shoulder, not specified as traumatic"},
  {c:"M75.101",l:"Unspecified rotator cuff tear or rupture of right shoulder, not specified as traumatic"},
  {c:"M75.102",l:"Unspecified rotator cuff tear or rupture of left shoulder, not specified as traumatic"},
  {c:"M75.11",l:"Incomplete rotator cuff tear or rupture not specified as traumatic"},
  {c:"M75.110",l:"Incomplete rotator cuff tear or rupture of unspecified shoulder, not specified as traumatic"},
  {c:"M75.111",l:"Incomplete rotator cuff tear or rupture of right shoulder, not specified as traumatic"},
  {c:"M75.112",l:"Incomplete rotator cuff tear or rupture of left shoulder, not specified as traumatic"},
  {c:"M75.12",l:"Complete rotator cuff tear or rupture not specified as traumatic"},
  {c:"M75.120",l:"Complete rotator cuff tear or rupture of unspecified shoulder, not specified as traumatic"},
  {c:"M75.121",l:"Complete rotator cuff tear or rupture of right shoulder, not specified as traumatic"},
  {c:"M75.122",l:"Complete rotator cuff tear or rupture of left shoulder, not specified as traumatic"},
  {c:"M75.2",l:"Bicipital tendinitis"},
  {c:"M75.20",l:"Bicipital tendinitis, unspecified shoulder"},
  {c:"M75.21",l:"Bicipital tendinitis, right shoulder"},
  {c:"M75.22",l:"Bicipital tendinitis, left shoulder"},
  {c:"M75.3",l:"Calcific tendinitis of shoulder"},
  {c:"M75.30",l:"Calcific tendinitis of unspecified shoulder"},
  {c:"M75.31",l:"Calcific tendinitis of right shoulder"},
  {c:"M75.32",l:"Calcific tendinitis of left shoulder"},
  {c:"M75.4",l:"Impingement syndrome of shoulder"},
  {c:"M75.40",l:"Impingement syndrome of unspecified shoulder"},
  {c:"M75.41",l:"Impingement syndrome of right shoulder"},
  {c:"M75.42",l:"Impingement syndrome of left shoulder"},
  {c:"M75.5",l:"Bursitis of shoulder"},
  {c:"M75.50",l:"Bursitis of unspecified shoulder"},
  {c:"M75.51",l:"Bursitis of right shoulder"},
  {c:"M75.52",l:"Bursitis of left shoulder"},
  {c:"M75.8",l:"Other shoulder lesions"},
  {c:"M75.80",l:"Other shoulder lesions, unspecified shoulder"},
  {c:"M75.81",l:"Other shoulder lesions, right shoulder"},
  {c:"M75.82",l:"Other shoulder lesions, left shoulder"},
  {c:"M75.9",l:"Shoulder lesion, unspecified"},
  {c:"M75.90",l:"Shoulder lesion, unspecified, unspecified shoulder"},
  {c:"M75.91",l:"Shoulder lesion, unspecified, right shoulder"},
  {c:"M75.92",l:"Shoulder lesion, unspecified, left shoulder"},
  {c:"M76.0",l:"Gluteal tendinitis"},
  {c:"M76.00",l:"Gluteal tendinitis, unspecified hip"},
  {c:"M76.01",l:"Gluteal tendinitis, right hip"},
  {c:"M76.02",l:"Gluteal tendinitis, left hip"},
  {c:"M76.1",l:"Psoas tendinitis"},
  {c:"M76.10",l:"Psoas tendinitis, unspecified hip"},
  {c:"M76.11",l:"Psoas tendinitis, right hip"},
  {c:"M76.12",l:"Psoas tendinitis, left hip"},
  {c:"M76.2",l:"Iliac crest spur"},
  {c:"M76.20",l:"Iliac crest spur, unspecified hip"},
  {c:"M76.21",l:"Iliac crest spur, right hip"},
  {c:"M76.22",l:"Iliac crest spur, left hip"},
  {c:"M76.3",l:"Iliotibial band syndrome"},
  {c:"M76.30",l:"Iliotibial band syndrome, unspecified leg"},
  {c:"M76.31",l:"Iliotibial band syndrome, right leg"},
  {c:"M76.32",l:"Iliotibial band syndrome, left leg"},
  {c:"M76.4",l:"Tibial collateral bursitis [Pellegrini-Stieda]"},
  {c:"M76.40",l:"Tibial collateral bursitis [Pellegrini-Stieda], unspecified leg"},
  {c:"M76.41",l:"Tibial collateral bursitis [Pellegrini-Stieda], right leg"},
  {c:"M76.42",l:"Tibial collateral bursitis [Pellegrini-Stieda], left leg"},
  {c:"M76.5",l:"Patellar tendinitis"},
  {c:"M76.50",l:"Patellar tendinitis, unspecified knee"},
  {c:"M76.51",l:"Patellar tendinitis, right knee"},
  {c:"M76.52",l:"Patellar tendinitis, left knee"},
  {c:"M76.6",l:"Achilles tendinitis"},
  {c:"M76.60",l:"Achilles tendinitis, unspecified leg"},
  {c:"M76.61",l:"Achilles tendinitis, right leg"},
  {c:"M76.62",l:"Achilles tendinitis, left leg"},
  {c:"M76.7",l:"Peroneal tendinitis"},
  {c:"M76.70",l:"Peroneal tendinitis, unspecified leg"},
  {c:"M76.71",l:"Peroneal tendinitis, right leg"},
  {c:"M76.72",l:"Peroneal tendinitis, left leg"},
  {c:"M76.8",l:"Other specified enthesopathies of lower limb, excluding foot"},
  {c:"M76.81",l:"Anterior tibial syndrome"},
  {c:"M76.811",l:"Anterior tibial syndrome, right leg"},
  {c:"M76.812",l:"Anterior tibial syndrome, left leg"},
  {c:"M76.819",l:"Anterior tibial syndrome, unspecified leg"},
  {c:"M76.82",l:"Posterior tibial tendinitis"},
  {c:"M76.821",l:"Posterior tibial tendinitis, right leg"},
  {c:"M76.822",l:"Posterior tibial tendinitis, left leg"},
  {c:"M76.829",l:"Posterior tibial tendinitis, unspecified leg"},
  {c:"M76.89",l:"Other specified enthesopathies of lower limb, excluding foot"},
  {c:"M76.891",l:"Other specified enthesopathies of right lower limb, excluding foot"},
  {c:"M76.892",l:"Other specified enthesopathies of left lower limb, excluding foot"},
  {c:"M76.899",l:"Other specified enthesopathies of unspecified lower limb, excluding foot"},
  {c:"M76.9",l:"Unspecified enthesopathy, lower limb, excluding foot"},
  {c:"M77.0",l:"Medial epicondylitis"},
  {c:"M77.00",l:"Medial epicondylitis, unspecified elbow"},
  {c:"M77.01",l:"Medial epicondylitis, right elbow"},
  {c:"M77.02",l:"Medial epicondylitis, left elbow"},
  {c:"M77.1",l:"Lateral epicondylitis"},
  {c:"M77.10",l:"Lateral epicondylitis, unspecified elbow"},
  {c:"M77.11",l:"Lateral epicondylitis, right elbow"},
  {c:"M77.12",l:"Lateral epicondylitis, left elbow"},
  {c:"M77.2",l:"Periarthritis of wrist"},
  {c:"M77.20",l:"Periarthritis, unspecified wrist"},
  {c:"M77.21",l:"Periarthritis, right wrist"},
  {c:"M77.22",l:"Periarthritis, left wrist"},
  {c:"M77.3",l:"Calcaneal spur"},
  {c:"M77.30",l:"Calcaneal spur, unspecified foot"},
  {c:"M77.31",l:"Calcaneal spur, right foot"},
  {c:"M77.32",l:"Calcaneal spur, left foot"},
  {c:"M77.4",l:"Metatarsalgia"},
  {c:"M77.40",l:"Metatarsalgia, unspecified foot"},
  {c:"M77.41",l:"Metatarsalgia, right foot"},
  {c:"M77.42",l:"Metatarsalgia, left foot"},
  {c:"M77.5",l:"Other enthesopathy of foot and ankle"},
  {c:"M79.1",l:"Myalgia"},
  {c:"M79.7",l:"Fibromyalgia"},
  {c:"M80.08XA",l:"Age-related osteoporosis with current pathological fracture, vertebra(e), initial encounter for fracture"},
  {c:"M81.0",l:"Age-related osteoporosis without current pathological fracture"},
  {c:"S42.201D",l:"Unspecified fracture of upper end of right humerus, subsequent encounter for closed fracture with routine healing"},
  {c:"S43.401A",l:"Unspecified sprain of right shoulder joint, initial encounter"},
  {c:"S43.401D",l:"Unspecified sprain of right shoulder joint, subsequent encounter"},
  {c:"S52.501D",l:"Unspecified fracture of the lower end of right radius, subsequent encounter for closed fracture with routine healing"},
  {c:"S62.001D",l:"Unspecified fracture of navicular [scaphoid] bone of right wrist, subsequent encounter for closed fracture with routine healing"},
  {c:"S72.001D",l:"Fracture of unspecified part of neck of right femur, subsequent encounter for closed fracture with routine healing"},
  {c:"S72.002D",l:"Fracture of unspecified part of neck of left femur, subsequent encounter for closed fracture with routine healing"},
  {c:"S72.91XD",l:"Unspecified fracture of right femur, subsequent encounter for closed fracture with routine healing"},
  {c:"S82.001D",l:"Unspecified fracture of right patella, subsequent encounter for closed fracture with routine healing"},
  {c:"S82.101D",l:"Unspecified fracture of upper end of right tibia, subsequent encounter for closed fracture with routine healing"},
  {c:"S83.511D",l:"Sprain of anterior cruciate ligament of right knee, subsequent encounter"},
  {c:"S83.512D",l:"Sprain of anterior cruciate ligament of left knee, subsequent encounter"},
  {c:"S86.011D",l:"Strain of right Achilles tendon, subsequent encounter"},
  {c:"S86.012D",l:"Strain of left Achilles tendon, subsequent encounter"},
  {c:"S93.401D",l:"Sprain of unspecified ligament of right ankle, subsequent encounter"},
  {c:"S93.402D",l:"Sprain of unspecified ligament of left ankle, subsequent encounter"},
  {c:"S96.811D",l:"Strain of other specified muscles and tendons at ankle and foot level, right foot, subsequent encounter"},
  {c:"Z47.1",l:"Aftercare following joint replacement surgery"},
  {c:"Z47.89",l:"Encounter for other orthopedic aftercare"}
];
/* Expand the compact {c,l} shape back to {code,label} so the rest of the app reads naturally. */
const ICD_SEED = ICD_SEED_RAW.map(d => ({ code: d.c, label: d.l }));

/* Section → region mapping. Ranges follow the CMS ICD-10-CM 3-char-block structure
   used by icd10data.com chapter indexes. The first prefix that matches wins. */
const ICD_SECTIONS = [
  // ── M (MSK) ──
  ["M00","M02","MSK","Infectious arthropathies"],
  ["M04","M14","MSK","Inflammatory arthropathies"],
  ["M15","M19","MSK","Osteoarthritis"],
  ["M20","M25","MSK","Joint disorders"],
  ["M26","M27","MSK","Jaw / dentofacial"],
  ["M30","M36","MSK","Connective tissue"],
  ["M40","M43","MSK","Spine — deforming dorsopathies"],
  ["M45","M49","MSK","Spine — spondylopathies"],
  ["M50","M54","MSK","Spine — other dorsopathies"],
  ["M60","M63","MSK","Muscle disorders"],
  ["M65","M67","MSK","Synovium / tendon"],
  ["M70","M79","MSK","Soft tissue / overuse"],
  ["M80","M85","MSK","Bone density / structure"],
  ["M86","M90","MSK","Other osteopathies"],
  ["M91","M94","MSK","Chondropathies"],
  ["M95","M99","MSK","Other MSK"],
  // ── G (Nervous system) ──
  ["G00","G09","Neuro","CNS — inflammatory"],
  ["G10","G14","Neuro","Atrophies"],
  ["G20","G26","Neuro","Movement / extrapyramidal"],
  ["G30","G32","Neuro","Degenerative"],
  ["G35","G37","Neuro","Demyelinating"],
  ["G40","G47","Neuro","Episodic / sleep"],
  ["G50","G59","Neuro","Nerve / root / plexus"],
  ["G60","G65","Neuro","Polyneuropathies"],
  ["G70","G73","Neuro","Neuromuscular junction / muscle"],
  ["G80","G83","Neuro","Cerebral palsy / paralytic"],
  ["G89","G99","Neuro","Other neuro / pain"],
  // ── S (Injuries) ──
  ["S00","S09","Injury","Head"],
  ["S10","S19","Injury","Neck"],
  ["S20","S29","Injury","Thorax"],
  ["S30","S39","Injury","Abdomen / lumbar / pelvis"],
  ["S40","S49","Injury","Shoulder / upper arm"],
  ["S50","S59","Injury","Elbow / forearm"],
  ["S60","S69","Injury","Wrist / hand"],
  ["S70","S79","Injury","Hip / thigh"],
  ["S80","S89","Injury","Knee / lower leg"],
  ["S90","S99","Injury","Ankle / foot"],
  // ── Z (Aftercare) — bucketed under Injury chip for physio relevance ──
  ["Z47","Z47","Injury","Orthopedic aftercare"],
];
const _icdLookup = (code) => {
  const root = code.slice(0, 3);
  for (const [a, b, ch, region] of ICD_SECTIONS) if (root >= a && root <= b) return { ch, region };
  return { ch: "Other", region: "Other" };
};
const ICD = ICD_SEED.map(d => ({ ...d, ...(_icdLookup(d.code)) }));

/* Common Cairo physio diagnoses — curated empty state.
   Shown when the search field is empty so doctors hit familiar codes in one tap
   instead of scrolling 500+ entries. Reorder freely; codes must exist in ICD_SEED. */
const COMMON_DX_CODES = [
  "M54.50","M54.16","M54.2","M51.26",        // spine — top 4 by volume
  "M17.10","M17.0","M16.10",                  // OA knee/hip
  "M75.00","M75.40","M25.511",                // shoulder
  "M72.2","M76.61","G57.51","G57.52",         // foot/ankle incl. Mona-type
  "G56.00","G51.0","G20.A2","G35","G81.10",   // neuro — common rehab
  "M79.7","M79.1","M62.830",                  // muscle pain / fibro
];
const COMMON_DX = COMMON_DX_CODES
  .map(c => ICD.find(d => d.code === c))
  .filter(Boolean);
const ZONES = [
  // Cairo — central & east
  "Downtown (Wast El Balad)","Garden City","Zamalek","Maadi","Old Maadi","New Maadi","Degla","Manial","Sayeda Zeinab","Abdeen",
  "Nasr City","Heliopolis (Masr El Gedida)","Roxy","Korba","Sheraton","Almaza","Ain Shams","El Marg","Matareya","Hadayek El Kobba",
  "Abbassia","Ghamra","Shubra","Rod El Farag","Helwan","El Maasara","Tora","Mokattam","Manshiyat Naser","Zawya El Hamra",
  // New Cairo & east expansions
  "New Cairo (Tagamoa)","1st Settlement","3rd Settlement","5th Settlement","Rehab","Madinaty","Shorouk","Obour","Badr City","Future City",
  // Giza
  "Dokki","Mohandessin","Agouza","Giza Square","Haram (Pyramids)","Faisal","Omraneya","Bein El Sarayat","Imbaba","Warraq",
  "Boulak El Dakrour","Sheikh Zayed","6th October","Hadayek El Ahram","Smart Village","Dreamland","Beverly Hills",
  // Qalyubia (north)
  "Shubra El Kheima","Banha","Qalyub","Khanka","Obour (Qalyubia)",
  "Other / outside Greater Cairo",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SLOT_TIMES = ["09:00","11:00","13:00","15:00","17:00","19:00"];
const PAY_STATUS = ["Paid","Pending","Partial","Waived"];
const PAY_METHOD = ["Cash","Instapay","Vodafone Cash","Bank Transfer","Other"];
const payColor = {Paid:C.green,Pending:C.amber,Partial:"#D9714E",Waived:C.grey};
const egp = n => `${Math.round(n||0).toLocaleString()} EGP`;

const painColor=(n)=>n<=2?C.green:n<=4?"#8FB339":n<=6?C.amber:n<=8?"#D9714E":C.red;
const respColor={better:C.green,same:C.grey,mixed:C.amber,worse:C.red};

/* ---- patient lifecycle ---- */
const STATUSES=["lead","follow_up","didnt_reply","booked","active","paused","discharged","lost"];
const STATUS_LABEL={lead:"Lead",follow_up:"Follow-up",didnt_reply:"Didn't reply",booked:"Booked",active:"Active",paused:"Paused",discharged:"Discharged",lost:"Lost"};
const statusColor={lead:C.amber,follow_up:"#E6A765",didnt_reply:"#B5A78A",booked:C.teal,active:C.green,paused:C.grey,discharged:C.ink,lost:C.red};
/* Statuses an admin can set directly on an existing patient (booked/active/discharged
   are state machine transitions, not manual flags). */
const MANUAL_STATUS_OPTIONS=["follow_up","didnt_reply","paused","lost","active"];

/* ---- visit & note state machines ---- */
const VISIT_TYPES=["Assessment","Treatment","Follow_up","Discharge"];
const VISIT_TYPE_LABEL={Assessment:"Assessment",Treatment:"Treatment",Follow_up:"Follow-up",Discharge:"Discharge"};
const VISIT_STATUSES=["scheduled","confirmed","in_progress","completed","cancelled","no_show"];
const VISIT_STATUS_LABEL={scheduled:"Scheduled",confirmed:"Confirmed",in_progress:"In progress",completed:"Completed",cancelled:"Cancelled",no_show:"No-show"};
const visitStatusColor={scheduled:C.grey,confirmed:C.teal,in_progress:C.amber,completed:C.green,cancelled:"#8794A1",no_show:C.red};
const NOTE_STATES=["draft","submitted","under_review","approved","approved_comment","returned"];
const NOTE_STATE_LABEL={draft:"Draft",submitted:"Submitted",under_review:"Under review",approved:"Approved",approved_comment:"Approved · comment",returned:"Returned"};

const nowISO=()=>new Date().toISOString();

/* ---------- shared diagnosis picker ---------- */
function DxSheet({open,onClose,onPick}){
  const[q,setQ]=useState(""),[ch,setCh]=useState("All");
  const ql=q.trim().toLowerCase();
  /* dot-insensitive code search: "m5450" matches "M54.50" */
  const qCode=ql.replace(/\./g,"");
  const groups=useMemo(()=>{
    /* Empty-state path: no query → show curated common diagnoses only. Cheap + ergonomic. */
    if(!ql){
      const pool=ch==="All"?COMMON_DX:COMMON_DX.filter(d=>d.ch===ch);
      const by={};pool.forEach(d=>{(by[d.region]||=[]).push(d)});
      return{by,total:pool.length,curated:true};
    }
    /* Search path: filter the full ICD set */
    let r=ICD;
    if(ch!=="All")r=r.filter(d=>d.ch===ch);
    r=r.filter(d=>d.label.toLowerCase().includes(ql)||d.code.toLowerCase().replace(/\./g,"").includes(qCode));
    /* Cap rendering at 200 per region to keep the sheet responsive on mobile.
       In practice almost no query exceeds this; the cap is a safety rail. */
    const by={};let shown=0;
    for(const d of r){(by[d.region]||=[]).push(d);shown++;}
    Object.keys(by).forEach(k=>{if(by[k].length>200)by[k]=by[k].slice(0,200);});
    return{by,total:r.length,curated:false};
  },[ql,qCode,ch]);
  if(!open)return null;
  const has=Object.keys(groups.by).length>0;
  const chipColors={MSK:"#EAF6F7",Neuro:"#FBF1E6",Injury:"#F4ECE6",Other:"#EFEFEC"};
  const chipText={MSK:"#2E6E73",Neuro:"#9A6B2F",Injury:"#7A4A2E",Other:C.grey};
  return(<div className="absolute inset-0 z-50 flex flex-col" style={{background:C.bg}}>
    <div className="px-4 pt-5 pb-3" style={{background:C.ink}}>
      <div className="flex items-center gap-3"><button onClick={onClose}><X size={22} color="#fff"/></button>
        <span className="text-white font-semibold text-[15px]">Diagnosis · ICD-10-CM</span></div>
      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 mt-3" style={{border:`1px solid ${C.line}`}}>
        <Search size={18} color={C.grey}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search condition or code…" className="flex-1 outline-none text-[15px]" style={{color:C.ink}}/></div>
      <div className="flex gap-2 mt-2.5">{["All","MSK","Neuro","Injury"].map(c=>(
        <button key={c} onClick={()=>setCh(c)} className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold" style={{background:ch===c?C.teal:"rgba(255,255,255,0.12)",color:ch===c?C.ink:"#fff"}}>{c==="MSK"?"MSK (M)":c==="Neuro"?"Neuro (G)":c==="Injury"?"Injury (S)":"All"}</button>))}</div>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {groups.curated&&<div className="text-[11px] mb-3 flex items-center gap-1.5" style={{color:C.grey}}>
        <Activity size={11}/>Common diagnoses · type to search the full ICD library</div>}
      {Object.entries(groups.by).map(([region,items])=>(<div key={region} className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:C.grey}}>{region}</div>
        <div className="bg-white rounded-xl overflow-hidden" style={{border:`1px solid ${C.line}`}}>
          {items.map((d,i)=>(<button key={d.code} onClick={()=>{onPick({code:d.code,label:d.label});onClose();}} className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-gray-50" style={{borderTop:i?`1px solid ${C.line}`:"none"}}>
            <span className="text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap" style={{background:chipColors[d.ch]||chipColors.Other,color:chipText[d.ch]||chipText.Other}}>{d.code}</span>
            <span className="text-[14px] flex-1" style={{color:C.ink}}>{d.label}</span></button>))}</div></div>))}
      {ql.length>=2&&<button onClick={()=>{onPick({code:null,label:q.trim()});onClose();}} className="w-full bg-white rounded-xl px-4 py-4 text-left text-[15px] flex items-center gap-2" style={{color:C.ink,border:`1px dashed ${C.amber}`}}><Pencil size={16} color={C.amber}/>Use free text: “<b>{q.trim()}</b>”</button>}
      {ql.length>=2&&!has&&<p className="text-[12px] mt-2" style={{color:C.grey}}>No ICD match — captured as free text.</p>}
      {!groups.curated&&groups.total>0&&<p className="text-[11px] mt-3 text-center" style={{color:C.grey}}>{groups.total} match{groups.total===1?"":"es"} · refine search to narrow</p>}
    </div></div>);
}

const Field=({label,optional,children})=>(<label className="block">
  <span className="text-[12px] font-semibold" style={{color:C.ink2}}>{label}{optional&&<span style={{color:C.amber}}> · optional</span>}</span>
  <div className="mt-1">{children}</div></label>);
const inp="w-full px-3 py-2.5 rounded-xl text-[15px] outline-none bg-white";

/* ---------- reusable filtration toolkit ---------- */
const inRange=(d,from,to)=>!d?(!from&&!to):((!from||d>=from)&&(!to||d<=to));
function FilterBar({children,onClear}){return(<div className="flex flex-wrap items-center gap-2 mb-4 bg-white rounded-2xl px-3 py-2.5" style={{border:`1px solid ${C.line}`}}>
  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{color:C.grey}}><Filter size={13}/>Filter</span>
  {children}
  {onClear&&<button onClick={onClear} className="ml-auto text-[12px] font-semibold px-2.5 py-1.5 rounded-lg" style={{color:C.grey}}>Clear</button>}</div>);}
function Sel({value,onChange,options,label}){return(<select value={value} onChange={e=>onChange(e.target.value)} className="text-[13px] px-2.5 py-2 rounded-lg bg-white outline-none" style={{border:`1px solid ${C.line}`,color:value?C.ink:C.grey}}>
  <option value="">{label}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>);}
function DateF({value,onChange,label}){return(<div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white" style={{border:`1px solid ${C.line}`}}>
  <span className="text-[11px]" style={{color:C.grey}}>{label}</span><input type="date" value={value} onChange={e=>onChange(e.target.value)} className="text-[13px] outline-none bg-transparent" style={{color:value?C.ink:C.grey}}/></div>);}
function Srch({value,onChange,ph}){return(<div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white" style={{border:`1px solid ${C.line}`}}>
  <Search size={14} color={C.grey}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={ph||"Search…"} className="text-[13px] outline-none bg-transparent w-32"/></div>);}

/* ---------- notification bell ---------- */
function NotifBell({items,onOpen,dark}){
  const[show,setShow]=useState(false);
  const unread=items.filter(n=>!n.read).length;
  const ago=ts=>{const m=Math.round((Date.now()-ts)/60000);return m<1?"now":m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`;};
  const toggle=()=>{const ns=!show;setShow(ns);if(ns)onOpen&&onOpen();};
  return(<div className="relative">
    <button onClick={toggle} className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{background:dark?"rgba(255,255,255,0.12)":"#fff",border:dark?"none":`1px solid ${C.line}`}}>
      <Bell size={17} color={dark?"#fff":C.ink}/>
      {unread>0&&<span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{background:C.red,color:"#fff"}}>{unread>9?"9+":unread}</span>}
    </button>
    {show&&<><div className="fixed inset-0 z-40" onClick={()=>setShow(false)}/>
      <div className="absolute right-0 mt-2 w-[300px] max-h-[360px] overflow-y-auto rounded-2xl z-50" style={{background:"#fff",border:`1px solid ${C.line}`,boxShadow:"0 12px 32px rgba(30,42,58,0.18)"}}>
        <div className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider sticky top-0" style={{color:C.grey,background:"#fff",borderBottom:`1px solid ${C.line}`}}>Notifications</div>
        {items.length===0&&<div className="px-4 py-6 text-[13px] text-center" style={{color:C.grey}}>Nothing yet — you’re all caught up.</div>}
        {items.map(n=>(<div key={n.id} className="px-4 py-3 flex gap-2.5" style={{borderTop:`1px solid ${C.line}`,background:n.read?"#fff":"#F4FBFC"}}>
          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{background:n.read?C.line:C.teal}}/>
          <div className="flex-1"><div className="text-[13px] leading-snug" style={{color:C.ink}}>{n.text}</div><div className="text-[11px] mt-0.5" style={{color:C.grey}}>{ago(n.ts)}</div></div>
        </div>))}
      </div></>}
  </div>);
}

/* =============================== APP =============================== */
export default function App(){
  const { user, profile, role, loading: authLoading, signOut } = useAuth();
  if (authLoading) return <FullScreenLoading label="Loading…" />;
  if (!user) return <Login />;
  if (!profile) return <FullScreenLoading label="Setting up your profile…" />;
  if (role !== 'admin' && role !== 'doctor') {
    return <FullScreenError msg="Your account has no role assigned. Ask an admin to set role=admin or role=doctor on your profile." onSignOut={signOut} />;
  }
  return <AppWithData role={role} me={profile.full_name || profile.email} onSignOut={signOut} />;
}

function FullScreenLoading({ label }){
  return <div className="min-h-screen flex items-center justify-center" style={{background:"#C9CDC9",color:C.ink}}>{label}</div>;
}
function FullScreenError({ msg, onSignOut }){
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center" style={{background:"#C9CDC9",color:C.ink}}>
      <div className="max-w-md">{msg}</div>
      <button onClick={onSignOut} className="px-4 py-2 rounded-lg font-bold text-sm" style={{background:C.teal,color:C.ink}}>Sign out</button>
    </div>
  );
}

function AppWithData({ role, me, onSignOut }){
  const store = useDataStore({ role, me });
  if (store.loading) return <FullScreenLoading label="Loading data…" />;
  if (store.error) return <FullScreenError msg={`Database error: ${store.error}. Check that the schema.sql has been run.`} onSignOut={onSignOut} />;

  const {
    doctors, patients, visits, notes, exerciseLib, modalityLib, finances, config, notifs,
    addPatient, assignDoctor, updatePatientStatus, dischargePatient,
    submitNote, reviewNote, openNoteForReview,
    addDoctor, removeDoctor, updateDoctorSlots, updateDoctorZones,
    updateFinance, updateVisitStatus, updateConfig,
    setExerciseLib, setModalityLib, markRead,
  } = store;
  const pending = notes.filter(n=>n.state==="submitted").length;

  return(
    <div className="min-h-screen flex flex-col items-center" style={{background:"#C9CDC9"}}>
      <div className="w-full flex items-center justify-between gap-2 py-2.5 px-4" style={{background:C.ink2}}>
        <span className="text-[11px] uppercase tracking-wider" style={{color:C.tealSoft}}>Signed in as {me} · {role}</span>
        <button onClick={onSignOut} className="px-3 py-1 rounded-full text-[11px] font-bold" style={{background:"transparent",color:"#fff",border:"1px solid #445"}}>Sign out</button>
      </div>
      {role==="admin"
        ? <Admin {...{patients,visits,notes,pending,doctors,exerciseLib,modalityLib,finances,config,setExerciseLib,setModalityLib,addPatient,assignDoctor,reviewNote,openNoteForReview,addDoctor,removeDoctor,updateDoctorSlots,updateFinance,dischargePatient,updatePatientStatus,updateVisitStatus,updateConfig,notifs,markRead}}/>
        : <Doctor {...{patients,visits,notes,me,doctors,exerciseLib,modalityLib,submitNote,updateDoctorSlots,updateDoctorZones,notifs,markRead}}/>}
    </div>
  );
}

// LEGACY mock-data app — kept as a backup if env vars not configured.
// Not exported; preserved for reference.
function _LegacyMockApp(){
  const[role,setRole]=useState("admin");

  const[doctors,setDoctors]=useState([
    {id:1,name:"Dr. Layla",spec:"Ortho / Neuro",zones:["Maadi","Zamalek","Dokki"],slots:["Sun-09:00","Sun-11:00","Tue-09:00","Tue-13:00","Thu-09:00"],files:["MSK protocol.pdf"]},
    {id:2,name:"Dr. Tarek",spec:"Sports / MSK",zones:["Heliopolis (Masr El Gedida)","Nasr City"],slots:["Mon-11:00","Wed-11:00","Wed-13:00"],files:[]},
    {id:3,name:"Dr. Nour",spec:"Geriatric / Neuro",zones:["6th October","Dokki","Giza Square"],slots:["Sat-09:00","Sat-11:00","Tue-13:00","Tue-15:00"],files:["Stroke rehab.pdf"]},
  ]);
  const[patients,setPatients]=useState([
    {id:1,name:"Mona A.",phone:"0111 234 5678",complaint:"Bilateral heel pain",history:"Bilateral tarsal tunnel release 6 wks ago",files:["op_note.pdf"],zone:"Maadi",locText:"Road 9, Maadi",locUrl:"",dx:{code:"G57.50",label:"Tarsal tunnel syndrome, unspecified lower limb"},status:"active",doctor:"Dr. Layla",payment:"Paid",
      statusHistory:[{from:null,to:"lead",by:"Admin",note:"WhatsApp inquiry",at:"2026-04-15T10:20:00Z"},{from:"lead",to:"booked",by:"Admin",note:"Assigned Dr. Layla",at:"2026-04-18T11:00:00Z"},{from:"booked",to:"active",by:"System",note:"First visit completed",at:"2026-04-20T13:00:00Z"}]},
    {id:2,name:"Hoda M.",phone:"0100 765 4321",complaint:"Right knee pain on stairs",history:"",files:[],zone:"Nasr City",locText:"",locUrl:"",dx:{code:"M17.9",label:"Osteoarthritis of knee, unspecified"},status:"active",doctor:"Dr. Tarek",payment:"Pending",
      statusHistory:[{from:null,to:"lead",by:"Admin",note:"Phone call",at:"2026-05-22T09:00:00Z"},{from:"lead",to:"booked",by:"Admin",note:null,at:"2026-05-23T10:00:00Z"},{from:"booked",to:"active",by:"System",note:"First visit completed",at:"2026-05-29T14:30:00Z"}]},
    {id:3,name:"Karim S.",phone:"0122 987 6543",complaint:"Chronic lower back stiffness",history:"Desk job 10+ years, no imaging yet",files:[],zone:"Heliopolis (Masr El Gedida)",locText:"",locUrl:"",dx:null,status:"follow_up",doctor:"—",payment:"Pending",
      statusHistory:[{from:null,to:"lead",by:"Admin",note:"WhatsApp",at:"2026-05-30T18:00:00Z"},{from:"lead",to:"follow_up",by:"Admin",note:"Asked to think about timing, said he'd call back",at:"2026-06-01T12:00:00Z"}]},
  ]);
  const[visits,setVisits]=useState([
    {id:1,patientId:1,doctorName:"Dr. Layla",type:"Treatment",time:"10:00",status:"confirmed"},
    {id:2,patientId:2,doctorName:"Dr. Tarek",type:"Treatment",time:"14:00",status:"scheduled"},
  ]);
  const[notes,setNotes]=useState([ // seeded history for Mona (approved) — drives charts
    {id:9001,patientId:1,patientName:"Mona A.",doctorName:"Dr. Layla",type:"Assessment",date:"2026-04-20",painBefore:8,painAfter:7,response:"same",exercises:["Retrograde edema massage · 10min","Nerve gliding · 2×10"],modalities:["Hot pack"],dx:{code:"G57.50",label:"Tarsal tunnel syndrome"},plan:"3-phase program, 12 wks",state:"approved"},
    {id:9002,patientId:1,patientName:"Mona A.",doctorName:"Dr. Layla",type:"Treatment",date:"2026-04-27",painBefore:7,painAfter:5,response:"better",exercises:["Towel calf stretch · 3×30s","Gait re-education · 10min"],modalities:["TENS"],dx:{code:"G57.50",label:"Tarsal tunnel syndrome"},plan:"",state:"approved"},
    {id:9003,patientId:1,patientName:"Mona A.",doctorName:"Dr. Layla",type:"Treatment",date:"2026-05-04",painBefore:6,painAfter:4,response:"better",exercises:["Seated calf raises · 3×15","Single leg stance · 3×15s"],modalities:[],dx:{code:"G57.50",label:"Tarsal tunnel syndrome"},plan:"",state:"approved"},
    {id:9004,patientId:1,patientName:"Mona A.",doctorName:"Dr. Layla",type:"Treatment",date:"2026-05-11",painBefore:5,painAfter:3,response:"better",exercises:["Resisted dorsiflexion · 3×15"],modalities:[],dx:{code:"G57.50",label:"Tarsal tunnel syndrome"},plan:"",state:"approved"},
    {id:9005,patientId:1,patientName:"Mona A.",doctorName:"Dr. Layla",type:"Treatment",date:"2026-05-18",painBefore:4,painAfter:2,response:"better",exercises:["Single leg stance · 3×15s"],modalities:[],dx:{code:"G57.50",label:"Tarsal tunnel syndrome"},plan:"",state:"approved"},
  ]);
  const[exerciseLib,setExerciseLib]=useState([
    {id:1,name:"Retrograde edema massage",dosageHint:"10 min",position:"Supine, legs elevated",description:"Strokes foot → ankle → calf to assist venous return",notes:"Use after surgery, before active work",mediaUrl:""},
    {id:2,name:"Towel calf stretch (knee straight)",dosageHint:"3 × 30s",position:"Long sitting",description:"Gastrocnemius stretch via towel around forefoot",notes:"Gentle — no forcing",mediaUrl:""},
    {id:3,name:"Nerve gliding (tibial)",dosageHint:"2 × 10",position:"Sitting, knee extended",description:"Sliding technique — dorsiflexion+toe ext ↔ plantarflex+toe flex",notes:"Stop if sharp electric pain",mediaUrl:""},
    {id:4,name:"Gait re-education",dosageHint:"10 min",position:"Standing, wall available",description:"Conscious heel → flat → toe pattern with verbal cueing",notes:"",mediaUrl:""},
    {id:5,name:"Seated calf raises",dosageHint:"3 × 15",position:"Sitting",description:"Bilateral ankle plantarflexion against gravity",notes:"Progress to standing when fully pain-free",mediaUrl:""},
    {id:6,name:"Resisted dorsiflexion (theraband)",dosageHint:"3 × 15",position:"Long sitting",description:"Light → medium band",notes:"Tibialis anterior strength",mediaUrl:""},
    {id:7,name:"Single leg stance",dosageHint:"3 × 15s",position:"Standing, wall nearby",description:"Eyes open → progress to eyes closed",notes:"Safety first — wall in reach",mediaUrl:""},
  ]);
  const[modalityLib,setModalityLib]=useState([{name:"Therapeutic ultrasound",params:"1MHz · 1.5 w/cm² · 5min"},{name:"TENS",params:"80–100Hz · 20min"},{name:"Hot pack",params:"15–20min"},{name:"Cryotherapy",params:"10–15min"}]);
  /* Config — editable defaults that feed intake / finance. Single-row in DB. */
  const[config,setConfig]=useState({defaultFee:500,defaultPct:0.6,currency:"EGP"});
  const updateConfig=(patch)=>setConfig(c=>({...c,...patch}));
  const[finances,setFinances]=useState([ // mirrors the Sessions Log
    {id:1,date:"2026-05-28",doctor:"Dr. Layla",patient:"Mona A.",type:"Treatment",fee:500,pct:0.6,status:"Paid",method:"Instapay"},
    {id:2,date:"2026-05-29",doctor:"Dr. Tarek",patient:"Hoda M.",type:"Assessment",fee:700,pct:0.5,status:"Pending",method:"Cash"},
    {id:3,date:"2026-05-30",doctor:"Dr. Layla",patient:"Mona A.",type:"Treatment",fee:500,pct:0.6,status:"Paid",method:"Cash"},
  ]);

  const me="Dr. Layla"; // doctor persona for the demo

  /* ---------- notifications ---------- */
  const[notifs,setNotifs]=useState([
    {id:1,ts:Date.now()-3600e3,target:"admin",text:"Dr. Tarek submitted an Assessment note for Hoda M.",read:true},
  ]);
  const notify=(target,text,to)=>setNotifs(ns=>[{id:Date.now()+Math.random(),ts:Date.now(),target,text,to,read:false},...ns]);
  const markRead=(target,to)=>setNotifs(ns=>ns.map(n=>(n.target===target&&(target==="admin"||!n.to||n.to===to))?{...n,read:true}:n));

  /* handlers — the connective tissue (each fires a notification + logs status history) */

  /* Central status mutator. Every patient.status transition routes through here so we
     never lose the audit trail. `actor` defaults to current role; `note` is optional. */
  const changeStatus=(pid,to,note,actor)=>{
    actor=actor||(role==="admin"?"Admin":me);
    setPatients(ps=>ps.map(p=>{
      if(p.id!==pid||p.status===to) return p;
      const entry={from:p.status,to,by:actor,note:note||null,at:nowISO()};
      return{...p,status:to,statusHistory:[...(p.statusHistory||[]),entry]};
    }));
  };
  const updatePatientStatus=(pid,to,note)=>{
    const pt=patients.find(p=>p.id===pid);
    changeStatus(pid,to,note);
    if(pt)notify("admin",`${pt.name} marked ${STATUS_LABEL[to]||to}${note?` — ${note}`:""}`);
  };

  const addPatient=(p,booked,date,doctor)=>{const id=Date.now();const to=booked?"booked":"lead";
    setPatients(ps=>[...ps,{...p,id,status:to,doctor:booked?doctor:"—",payment:"Pending",
      statusHistory:[{from:null,to,by:"Admin",note:booked?`Booked with ${doctor}`:"Intake — lead",at:nowISO()}]}]);
    if(booked)setVisits(vs=>[...vs,{id:id+1,patientId:id,doctorName:doctor,type:"Assessment",time:"12:00",date,status:"scheduled"}]);
    notify("admin",booked?`New booking: ${p.name} → ${doctor} (${date})`:`New lead added: ${p.name}`);
    if(booked)notify("doctor",`New patient booked with you: ${p.name}`,doctor);};
  const assignDoctor=(pid,name)=>{const pt=patients.find(p=>p.id===pid);
    setPatients(ps=>ps.map(p=>p.id===pid?{...p,doctor:name}:p));
    if(pt&&pt.status==="lead"&&name) changeStatus(pid,"booked",`Assigned ${name}`);
    setVisits(vs=>{const up=vs.find(v=>v.patientId===pid&&v.status!=="completed");
      if(up) return vs.map(v=>v.id===up.id?{...v,doctorName:name}:v); // move the existing upcoming visit to the new doctor
      if(!name) return vs;
      const hasHistory=vs.some(v=>v.patientId===pid&&v.status==="completed");
      return [...vs,{id:Date.now()+1,patientId:pid,doctorName:name,type:hasHistory?"Treatment":"Assessment",time:"to schedule",status:"scheduled"}];});
    if(name)notify("doctor",`You were assigned to ${pt?.name||"a patient"} — visit added to your list`,name);};
  const submitNote=(n)=>{const id=Date.now();
    setNotes(ns=>[...ns,{...n,id,state:"submitted",date:new Date().toISOString().slice(0,10)}]);
    setVisits(vs=>{let next=vs.map(v=>v.id===n.visitId?{...v,status:"completed"}:v);
      if(!vs.some(v=>v.id===n.visitId)) next=[...next,{id:n.visitId,patientId:n.patientId,doctorName:n.doctorName,type:n.type,time:"logged",status:"completed"}]; // independent session
      if(n.nextSessionDate) next=[...next,{id:id+1,patientId:n.patientId,doctorName:n.doctorName,type:"Treatment",time:"—",date:n.nextSessionDate,status:"scheduled"}]; // upcoming date set by doctor
      return next;});
    const pt=patients.find(p=>p.id===n.patientId);
    setPatients(ps=>ps.map(p=>p.id===n.patientId?{...p,dx:p.dx||n.dx}:p));
    if(pt&&pt.status!=="active") changeStatus(n.patientId,"active",`First note logged by ${n.doctorName}`,"System");
    setFinances(fs=>[...fs,{id:id+2,date:new Date().toISOString().slice(0,10),doctor:n.doctorName,patient:n.patientName,type:n.type,fee:config.defaultFee,pct:config.defaultPct,status:"Pending",method:"Cash"}]);
    notify("admin",`${n.doctorName} submitted a ${VISIT_TYPE_LABEL[n.type]||n.type} note for ${n.patientName} — awaiting review`);
    if(n.redFlag)notify("admin",`⚠ Red flag raised by ${n.doctorName} for ${n.patientName}`);};
  const reviewNote=(id,s)=>{const n=notes.find(x=>x.id===id);
    setNotes(ns=>ns.map(x=>x.id===id?{...x,state:s,reviewedAt:nowISO()}:x));
    const word=s==="approved"?"approved":s==="approved_comment"?"approved with a comment":"sent back for revision";
    if(n)notify("doctor",`Your ${VISIT_TYPE_LABEL[n.type]||n.type} note for ${n.patientName} was ${word}`,n.doctorName);};
  /* Mark a note as 'under_review' the moment admin opens it. Idempotent. */
  const openNoteForReview=(id)=>{setNotes(ns=>ns.map(x=>x.id===id&&x.state==="submitted"?{...x,state:"under_review",openedAt:nowISO()}:x));};
  const addDoctor=(d)=>{setDoctors(ds=>[...ds,{...d,id:Date.now(),files:[],slots:d.slots||[]}]);notify("admin",`Doctor added: ${d.name}`);};
  const removeDoctor=(id)=>{const d=doctors.find(x=>x.id===id);setDoctors(ds=>ds.filter(x=>x.id!==id));if(d)notify("admin",`Doctor removed: ${d.name}`);};
  const dischargePatient=(pid,report)=>{const pt=patients.find(p=>p.id===pid);
    setPatients(ps=>ps.map(p=>p.id===pid?{...p,discharge:report}:p));
    changeStatus(pid,"discharged",`${report?.improvePct??0}% improvement over ${report?.sessions??0} sessions`);
    notify("admin",`${pt?.name||"Patient"} discharged — ${report?.improvePct??0}% improvement over ${report?.sessions??0} sessions`);};
  const updateDoctorSlots=(id,slots,actor="admin")=>{const d=doctors.find(x=>x.id===id);
    setDoctors(ds=>ds.map(x=>x.id===id?{...x,slots}:x));
    if(actor==="doctor")notify("admin",`${d?.name||"A doctor"} updated their availability (${slots.length} slots/wk)`);
    else notify("doctor",`Admin updated your availability (${slots.length} slots/wk)`,d?.name);};
  const updateDoctorZones=(id,zones,actor="admin")=>{const d=doctors.find(x=>x.id===id);
    setDoctors(ds=>ds.map(x=>x.id===id?{...x,zones}:x));
    if(actor==="doctor")notify("admin",`${d?.name||"A doctor"} updated their coverage zones (${zones.length})`);
    else notify("doctor",`Admin updated your coverage zones (${zones.length})`,d?.name);};
  const updateFinance=(id,patch)=>setFinances(fs=>fs.map(f=>f.id===id?{...f,...patch}:f));
  const updateVisitStatus=(vid,status)=>{setVisits(vs=>vs.map(v=>v.id===vid?{...v,status}:v));
    const v=visits.find(x=>x.id===vid);if(v){const pt=patients.find(p=>p.id===v.patientId);
      notify("admin",`${pt?.name||"Visit"} → ${VISIT_STATUS_LABEL[status]||status}`);}};

  const pending=notes.filter(n=>n.state==="submitted").length;

  return(
    <div className="min-h-screen flex flex-col items-center" style={{background:"#C9CDC9"}}>
      <div className="w-full flex items-center justify-center gap-2 py-2.5" style={{background:C.ink2}}>
        <span className="text-[11px] uppercase tracking-wider" style={{color:C.tealSoft}}>View as</span>
        {["admin","doctor"].map(r=>(<button key={r} onClick={()=>setRole(r)} className="px-4 py-1.5 rounded-full text-[12px] font-bold capitalize"
          style={{background:role===r?C.teal:"transparent",color:role===r?C.ink:"#fff",border:`1px solid ${role===r?C.teal:"#445"}`}}>{r}</button>))}
      </div>
      {role==="admin"
        ? <Admin {...{patients,visits,notes,pending,doctors,exerciseLib,modalityLib,finances,config,setExerciseLib,setModalityLib,addPatient,assignDoctor,reviewNote,openNoteForReview,addDoctor,removeDoctor,updateDoctorSlots,updateFinance,dischargePatient,updatePatientStatus,updateVisitStatus,updateConfig,notifs,markRead}}/>
        : <Doctor {...{patients,visits,notes,me,doctors,exerciseLib,modalityLib,submitNote,updateDoctorSlots,updateDoctorZones,notifs,markRead}}/>}
    </div>
  );
}

/* =============================== ADMIN =============================== */
function Admin({patients,visits,notes,pending,doctors,exerciseLib,modalityLib,finances,config,setExerciseLib,setModalityLib,addPatient,assignDoctor,reviewNote,openNoteForReview,addDoctor,removeDoctor,updateDoctorSlots,updateFinance,dischargePatient,updatePatientStatus,updateVisitStatus,updateConfig,notifs,markRead}){
  const[tab,setTab]=useState("today");const[intake,setIntake]=useState(false);const[sel,setSel]=useState(null);const[viewP,setViewP]=useState(null);
  const nameOf=id=>patients.find(p=>p.id===id)?.name||"—";
  const queue=notes.filter(n=>n.state==="submitted"||n.state==="under_review");
  const tabs=[["today","Today",LayoutGrid],["patients","Patients",Users],["review","Review",ClipboardCheck],["doctors","Doctors",Stethoscope],["finances","Finances",Wallet],["library","Library",BookOpen],["settings","Settings",Settings]];
  const statusMix=STATUSES.map(s=>({name:STATUS_LABEL[s],key:s,v:patients.filter(p=>p.status===s).length})).filter(x=>x.v);
  const byDoctorVisits=doctors.map(d=>({name:(d.name.split(" ")[1]||d.name),v:visits.filter(v=>v.doctorName===d.name).length}));
  const docNames=doctors.map(d=>d.name);

  /* ---- filters ---- */
  const[tF,setTF]=useState({doctor:"",status:"",type:"",from:"",to:""});
  const[pF,setPF]=useState({q:"",status:"",doctor:"",zone:""});
  const[rF,setRF]=useState({doctor:"",type:"",red:""});
  const[hoverP,setHoverP]=useState(null);
  const fVisits=visits.filter(v=>(!tF.doctor||v.doctorName===tF.doctor)&&(!tF.status||v.status===tF.status)&&(!tF.type||v.type===tF.type)&&(!(tF.from||tF.to)||inRange(v.date,tF.from,tF.to)));
  const fPatients=patients.filter(p=>(!pF.q||p.name.toLowerCase().includes(pF.q.toLowerCase()))&&(!pF.status||p.status===pF.status)&&(!pF.doctor||p.doctor===pF.doctor)&&(!pF.zone||p.zone===pF.zone));
  const fQueue=queue.filter(n=>(!rF.doctor||n.doctorName===rF.doctor)&&(!rF.type||n.type===rF.type)&&(!rF.red||n.redFlag));

  return(<div className="w-full max-w-[1040px] min-h-screen flex flex-col" style={{background:C.bg}}>
    <header className="flex items-center justify-between px-6 py-4" style={{background:"#fff",borderBottom:`1px solid ${C.line}`}}>
      <h1 className="text-[22px] font-bold capitalize" style={{fontFamily:"Georgia,serif",color:C.ink}}>{tab}</h1>
      <div className="flex items-center gap-3">
        <NotifBell items={(notifs||[]).filter(n=>n.target==="admin")} onOpen={()=>markRead&&markRead("admin")}/>
        <button onClick={()=>setIntake(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white font-semibold text-[14px]" style={{background:C.ink}}><Plus size={16}/>New patient</button>
      </div>
    </header>
    <div className="flex gap-1 px-6 py-2 overflow-x-auto" style={{background:"#fff",borderBottom:`1px solid ${C.line}`}}>
      {tabs.map(([k,l,Icon])=>(<button key={k} onClick={()=>setTab(k)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap" style={{background:tab===k?C.ink:"transparent",color:tab===k?"#fff":C.ink2}}>
        <Icon size={15}/>{l}{k==="review"&&pending>0&&<span className="text-[11px] px-1.5 rounded-full font-bold" style={{background:C.red,color:"#fff"}}>{pending}</span>}</button>))}
    </div>

    <div className="flex-1 overflow-y-auto p-6">
      {/* TODAY — KPIs + at-a-glance charts, then the visit list */}
      {tab==="today"&&<>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[["Visits today",visits.length,C.ink],["Completed",visits.filter(v=>v.status==="completed").length,C.green],["In queue",pending,C.amber],["Active patients",patients.filter(p=>p.status==="active").length,"#2E6E73"]].map(([l,n,c])=>(
            <div key={l} className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}><div className="text-[12px]" style={{color:C.grey}}>{l}</div><div className="text-[28px] font-bold mt-0.5" style={{color:c}}>{n}</div></div>))}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
            <h3 className="text-[13px] font-bold mb-3" style={{fontFamily:"Georgia,serif"}}>Visits by doctor</h3>
            <ResponsiveContainer width="100%" height={150}><BarChart data={byDoctorVisits}><XAxis dataKey="name" tick={{fontSize:11,fill:C.grey}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:11,fill:C.grey}} axisLine={false} tickLine={false} width={20}/><Bar dataKey="v" radius={[6,6,0,0]} fill={C.teal}/></BarChart></ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
            <h3 className="text-[13px] font-bold mb-3" style={{fontFamily:"Georgia,serif"}}>Patient status mix</h3>
            <div className="flex items-center gap-4"><ResponsiveContainer width="55%" height={150}><PieChart><Pie data={statusMix} dataKey="v" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3}>{statusMix.map(s=><Cell key={s.key} fill={statusColor[s.key]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
              <div className="space-y-1.5">{statusMix.map(s=><div key={s.key} className="flex items-center gap-2 text-[12px]"><span className="w-3 h-3 rounded-sm" style={{background:statusColor[s.key]}}/>{s.name}<b className="ml-1">{s.v}</b></div>)}</div></div>
          </div>
        </div>
        <FilterBar onClear={()=>setTF({doctor:"",status:"",type:"",from:"",to:""})}>
          <Sel value={tF.doctor} onChange={v=>setTF(s=>({...s,doctor:v}))} options={docNames} label="Doctor"/>
          <Sel value={tF.status} onChange={v=>setTF(s=>({...s,status:v}))} options={[...new Set(visits.map(v=>v.status))]} label="Status"/>
          <Sel value={tF.type} onChange={v=>setTF(s=>({...s,type:v}))} options={["Assessment","Treatment","Discharge","Follow-up"]} label="Type"/>
          <DateF value={tF.from} onChange={v=>setTF(s=>({...s,from:v}))} label="From"/>
          <DateF value={tF.to} onChange={v=>setTF(s=>({...s,to:v}))} label="To"/>
        </FilterBar>
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${C.line}`}}>
          {fVisits.length===0&&<div className="px-5 py-4 text-[13px]" style={{color:C.grey}}>No visits match these filters.</div>}
          {fVisits.map((v,i)=>(<div key={v.id} className="px-5 py-4 flex items-center justify-between" style={{borderTop:i?`1px solid ${C.line}`:"none"}}>
            <div className="flex items-center gap-3"><span className="font-bold tabular-nums">{v.date||v.time}</span>
              <div><div className="font-semibold">{nameOf(v.patientId)}</div><div className="text-[12px]" style={{color:C.grey}}>{v.doctorName} · {VISIT_TYPE_LABEL[v.type]||v.type}</div></div></div>
            <select value={v.status} onChange={e=>updateVisitStatus(v.id,e.target.value)} className="text-[11px] font-semibold px-2 py-1 rounded-full outline-none cursor-pointer" style={{background:visitStatusColor[v.status]+"22",color:visitStatusColor[v.status],border:`1px solid ${visitStatusColor[v.status]}44`}}>
              {VISIT_STATUSES.map(s=><option key={s} value={s} style={{background:"#fff",color:C.ink}}>{VISIT_STATUS_LABEL[s]}</option>)}
            </select></div>))}
        </div>
      </>}

      {/* PATIENTS — incl. assign-doctor + admin-only payment */}
      {tab==="patients"&&<>
        <FilterBar onClear={()=>setPF({q:"",status:"",doctor:"",zone:""})}>
          <Srch value={pF.q} onChange={v=>setPF(s=>({...s,q:v}))} ph="Name…"/>
          <Sel value={pF.status} onChange={v=>setPF(s=>({...s,status:v}))} options={STATUSES} label="Status"/>
          <Sel value={pF.doctor} onChange={v=>setPF(s=>({...s,doctor:v}))} options={docNames} label="Doctor"/>
          <Sel value={pF.zone} onChange={v=>setPF(s=>({...s,zone:v}))} options={ZONES} label="Zone"/>
        </FilterBar>
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${C.line}`}}>
        {fPatients.length===0&&<div className="px-5 py-4 text-[13px]" style={{color:C.grey}}>No patients match these filters.</div>}
        {fPatients.map((p,i)=>(<div key={p.id} onClick={()=>setViewP(p)} onMouseEnter={()=>setHoverP(p.id)} onMouseLeave={()=>setHoverP(null)} role="button" title="Open patient profile" className="px-5 py-4 grid grid-cols-12 gap-3 items-center cursor-pointer" style={{borderTop:i?`1px solid ${C.line}`:"none",background:hoverP===p.id?"#F4FBFC":"#fff",transition:"background .12s"}}>
          <span className="col-span-3">
            <div className="font-semibold flex items-center gap-1.5" style={{color:C.ink}}>{p.name}<History size={13} color={hoverP===p.id?C.teal:C.grey}/></div>
            <div className="text-[11px] flex items-center gap-2 mt-0.5" style={{color:C.grey}}><span>{p.zone}</span>
              <a href={`tel:${(p.phone||"").replace(/\s/g,"")}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1 hover:underline" style={{color:C.ink2}}><Phone size={11}/>{p.phone||"—"}</a></div></span>
          <span className="col-span-4 text-[13px] flex items-center gap-2" style={{color:C.ink2}}>
            {p.dx?<><span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{background:"#EAF6F7",color:"#2E6E73"}}>{p.dx.code||"free"}</span>{p.dx.label}</>:<span style={{color:C.grey}}>No dx yet</span>}</span>
          <span className="col-span-2"><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{background:statusColor[p.status]+"22",color:statusColor[p.status]}}>{STATUS_LABEL[p.status]||p.status}</span></span>
          <span className="col-span-2" onClick={e=>e.stopPropagation()}><select value={p.doctor==="—"?"":p.doctor} onChange={e=>assignDoctor(p.id,e.target.value)} className="text-[12px] px-2 py-1.5 rounded-lg bg-white w-full" style={{border:`1px solid ${C.line}`,color:p.doctor==="—"?C.grey:C.ink}}>
            <option value="">Assign…</option>{doctors.map(d=><option key={d.id}>{d.name}</option>)}</select></span>
          <span className="col-span-1 flex items-center gap-1 justify-end text-[11px] font-semibold" style={{color:p.payment==="Paid"?C.green:C.amber}}><Wallet size={12}/>{p.payment}</span>
        </div>))}
        <p className="text-[11px] px-5 py-2.5" style={{color:C.grey,borderTop:`1px solid ${C.line}`}}><Wallet size={11} className="inline mr-1"/>Payment column is admin-only — doctors never see it.</p>
      </div></>}

      {/* REVIEW */}
      {tab==="review"&&<div className="flex gap-5">
        <div className="w-[280px] space-y-2">
          <div className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{color:C.grey}}>Queue</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Sel value={rF.doctor} onChange={v=>setRF(s=>({...s,doctor:v}))} options={docNames} label="Doctor"/>
            <Sel value={rF.type} onChange={v=>setRF(s=>({...s,type:v}))} options={["Assessment","Treatment","Discharge","Follow-up"]} label="Type"/>
            <button onClick={()=>setRF(s=>({...s,red:s.red?"":"1"}))} className="text-[12px] font-semibold px-2.5 py-2 rounded-lg" style={{background:rF.red?C.red:"#fff",color:rF.red?"#fff":C.ink2,border:`1px solid ${rF.red?C.red:C.line}`}}>Red flags</button>
          </div>
          {fQueue.length===0&&<p className="text-[13px]" style={{color:C.grey}}>{queue.length?"No notes match.":"Empty — submit a note from the Doctor view."}</p>}
          {fQueue.map(n=>(<button key={n.id} onClick={()=>{setSel(n);openNoteForReview(n.id);}} className="w-full text-left bg-white rounded-xl p-3.5" style={{border:`1.5px solid ${sel?.id===n.id?C.teal:C.line}`}}>
            <div className="flex items-center justify-between"><span className="font-semibold">{n.patientName}</span>{n.redFlag&&<AlertTriangle size={15} color={C.red}/>}</div>
            <div className="text-[12px] mt-1" style={{color:C.grey}}>{n.doctorName} · {n.type}</div></button>))}
        </div>
        {(()=>{const cur=sel&&notes.find(n=>n.id===sel.id);return cur&&(cur.state==="submitted"||cur.state==="under_review")?<NoteReview key={cur.id} note={cur} onAction={s=>{reviewNote(cur.id,s);setSel(null);}}/>:
          <div className="flex-1 flex items-center justify-center text-[13px]" style={{color:C.grey}}>{queue.length?"Select a note":""}</div>;})()}
      </div>}

      {/* DOCTORS — log / add / remove / availability calendar / files / profile+cases */}
      {tab==="doctors"&&<DoctorsTab doctors={doctors} patients={patients} addDoctor={addDoctor} removeDoctor={removeDoctor} updateDoctorSlots={updateDoctorSlots}/>}

      {/* FINANCES — mirrors the Sessions Tracker (admin-only) */}
      {tab==="finances"&&<Finances finances={finances} updateFinance={updateFinance}/>}

      {/* LIBRARY — admin adds exercises + modalities */}
      {tab==="library"&&<LibraryTab exerciseLib={exerciseLib} modalityLib={modalityLib} setExerciseLib={setExerciseLib} setModalityLib={setModalityLib}/>}

      {/* SETTINGS — defaults that feed intake / finance / billing */}
      {tab==="settings"&&<SettingsTab config={config} updateConfig={updateConfig}/>}
    </div>

    {intake&&<Intake doctors={doctors} patients={patients} onOpenExisting={p=>{setIntake(false);setViewP(p);}} onClose={()=>setIntake(false)} onSave={(p,b,d,doc)=>{addPatient(p,b,d,doc);setIntake(false);}}/>}
    {viewP&&<PatientFile patient={patients.find(p=>p.id===viewP.id)||viewP} notes={notes} finances={finances} visits={visits} onClose={()=>setViewP(null)} onDischarge={(rep)=>dischargePatient(viewP.id,rep)} updatePatientStatus={updatePatientStatus}/>}
  </div>);
}

function NoteReview({note,onAction}){
  const[c,setC]=useState(false);
  return(<div className="flex-1 bg-white rounded-2xl p-6 self-start" style={{border:`1px solid ${C.line}`}}>
    <h2 className="text-[20px] font-bold" style={{fontFamily:"Georgia,serif",color:C.ink}}>{note.patientName}</h2>
    <div className="text-[13px] mb-4" style={{color:C.grey}}>{note.doctorName} · {note.type}</div>
    {note.redFlag&&<div className="rounded-xl p-3.5 mb-4 flex gap-2.5" style={{background:"#FDF3F1",border:`1px solid ${C.red}55`}}>
      <AlertTriangle size={17} color={C.red}/><div className="text-[13px]" style={{color:C.ink2}}><b style={{color:C.red}}>Red flag · </b>{note.redFlagNote||"reported"}</div></div>}
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="rounded-xl p-3" style={{background:"#F4F4F2"}}><div className="text-[11px]" style={{color:C.grey}}>Pain</div>
        <div className="flex items-center gap-1.5 mt-1"><span className="text-[20px] font-bold" style={{color:painColor(note.painBefore)}}>{note.painBefore}</span><ChevronRight size={14} color={C.grey}/><span className="text-[20px] font-bold" style={{color:painColor(note.painAfter)}}>{note.painAfter}</span></div></div>
      <div className="rounded-xl p-3" style={{background:"#F4F4F2"}}><div className="text-[11px]" style={{color:C.grey}}>Response</div><div className="mt-2"><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize" style={{background:respColor[note.response]+"22",color:respColor[note.response]}}>{note.response}</span></div></div>
      <div className="rounded-xl p-3" style={{background:"#F4F4F2"}}><div className="text-[11px]" style={{color:C.grey}}>Diagnosis</div><div className="text-[12px] font-semibold mt-1.5">{note.dx?note.dx.label:"—"}</div></div>
    </div>
    {note.exercises?.length>0&&<Tags label="Exercises" items={note.exercises}/>}
    {note.modalities?.length>0&&<Tags label="Modalities" items={note.modalities}/>}
    {note.plan&&<div className="mb-4"><div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:C.grey}}>Plan</div><div className="text-[13px]" style={{color:C.ink2}}>{note.plan}</div></div>}
    {note.nextSessionDate&&<div className="mb-4 flex items-center gap-1.5 text-[13px]" style={{color:C.ink2}}><Calendar size={13} color={C.teal}/>Next session booked: <b>{note.nextSessionDate}</b></div>}
    {c&&<textarea autoFocus placeholder="Teaching feedback for the doctor…" rows={2} className="w-full mb-3 px-3 py-2.5 rounded-xl text-[14px] outline-none resize-none" style={{border:`1px solid ${C.teal}`,background:"#F4FBFC"}}/>}
    <div className="flex gap-2 pt-3" style={{borderTop:`1px solid ${C.line}`}}>
      <button onClick={()=>onAction("approved")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-[14px]" style={{background:C.green}}><Check size={16}/>Approve</button>
      <button onClick={()=>c?onAction("approved_comment"):setC(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[14px]" style={{background:"#fff",color:C.ink,border:`1px solid ${C.line}`}}><MessageSquare size={16}/>{c?"Submit":"Comment"}</button>
      <button onClick={()=>onAction("returned")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[14px]" style={{background:"#fff",color:C.red,border:`1px solid ${C.red}55`}}><CornerUpLeft size={16}/>Send back</button>
    </div></div>);
}
const Tags=({label,items})=>(<div className="mb-4"><div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:C.grey}}>{label}</div>
  <div className="flex flex-wrap gap-2">{items.map(e=><span key={e} className="text-[12px] px-2.5 py-1.5 rounded-lg" style={{background:"#F4FBFC",color:C.ink,border:`1px solid ${C.tealSoft}`}}>{e}</span>)}</div></div>);

/* ---------- weekly availability grid (days × time slots) ---------- */
function SlotGrid({slots,onToggle}){
  return(<div className="overflow-x-auto -mx-1 px-1">{DAYS.map(day=>(<div key={day} className="flex items-center gap-1 mb-1">
    <span className="w-9 text-[11px] font-semibold flex-shrink-0" style={{color:C.ink2}}>{day}</span>
    {SLOT_TIMES.map(t=>{const k=`${day}-${t}`;const on=slots.includes(k);return(
      <button key={t} onClick={()=>onToggle(k)} className="flex-1 h-8 rounded-md text-[10px] font-semibold" style={{background:on?C.teal:"#F4F4F2",color:on?C.ink:C.grey,border:`1px solid ${on?C.teal:C.line}`}}>{t}</button>);})}
  </div>))}</div>);
}

/* ---------- Doctors management (with availability calendar) ---------- */
function DoctorsTab({doctors,patients,addDoctor,removeDoctor,updateDoctorSlots}){
  const[adding,setAdding]=useState(false);const[editing,setEditing]=useState(null);
  const[inviteMsg,setInviteMsg]=useState("");
  const[nd,setNd]=useState({name:"",spec:"",zones:[],slots:[],email:""});
  const caseCount=name=>patients.filter(p=>p.doctor===name).length;
  const toggleNd=k=>setNd(s=>({...s,slots:s.slots.includes(k)?s.slots.filter(x=>x!==k):[...s.slots,k]}));
  const daysOf=slots=>[...new Set((slots||[]).map(s=>s.split("-")[0]))];
  return(<>
    <div className="flex justify-end mb-4"><button onClick={()=>setAdding(a=>!a)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-[14px]" style={{background:adding?"#fff":C.ink,color:adding?C.ink:"#fff",border:`1px solid ${C.line}`}}>{adding?<X size={15}/>:<Plus size={15}/>}{adding?"Cancel":"Add doctor"}</button></div>
    {adding&&<div className="bg-white rounded-2xl p-5 mb-4 space-y-3" style={{border:`1px solid ${C.teal}`}}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input value={nd.name} onChange={e=>setNd(s=>({...s,name:e.target.value}))} placeholder="Dr. …" className={inp} style={{border:`1px solid ${C.line}`}}/></Field>
        <Field label="Specialty"><input value={nd.spec} onChange={e=>setNd(s=>({...s,spec:e.target.value}))} placeholder="Ortho / Neuro" className={inp} style={{border:`1px solid ${C.line}`}}/></Field>
      </div>
      <Field label="Login email (doctor signs in with this — no email sent)"><input type="email" value={nd.email} onChange={e=>setNd(s=>({...s,email:e.target.value}))} placeholder="doctor@example.com" className={inp} style={{border:`1px solid ${C.line}`}}/></Field>
      <Field label="Coverage zones"><div className="flex flex-wrap gap-2">{ZONES.map(z=>{const on=nd.zones.includes(z);return(
        <button key={z} onClick={()=>setNd(s=>({...s,zones:on?s.zones.filter(x=>x!==z):[...s.zones,z]}))} className="px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{background:on?C.teal:"#fff",color:on?C.ink:C.ink2,border:`1px solid ${on?C.teal:C.line}`}}>{z}</button>);})}</div></Field>
      <Field label="Availability — tap the slots they work"><SlotGrid slots={nd.slots} onToggle={toggleNd}/></Field>
      {inviteMsg&&<div className="text-[12px] px-3 py-2 rounded-lg" style={{background:inviteMsg.startsWith("✓")?"#dcfce7":"#fee2e2",color:inviteMsg.startsWith("✓")?"#166534":"#991b1b"}}>{inviteMsg}</div>}
      <button disabled={!nd.name} onClick={async()=>{
        setInviteMsg("");
        await addDoctor(nd);
        if(nd.email){
          setInviteMsg(`✓ Saved. ${nd.email} can now sign in on the Doctor tab and set a password.`);
        }
        setTimeout(()=>{setNd({name:"",spec:"",zones:[],slots:[],email:""});setAdding(false);setInviteMsg("");},nd.email?2600:0);
      }} className="px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-40" style={{background:C.ink}}>Save doctor</button>
    </div>}
    <div className="grid grid-cols-2 gap-4">
      {doctors.map(d=>(<div key={d.id} className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full flex items-center justify-center font-bold" style={{background:C.tealSoft,color:C.ink}}>{(d.name.split(" ")[1]||d.name)[0]}</div>
            <div><div className="font-bold text-[16px]" style={{fontFamily:"Georgia,serif"}}>{d.name}</div><div className="text-[12px]" style={{color:C.grey}}>{d.spec||"—"}</div></div></div>
          <button onClick={()=>removeDoctor(d.id)} className="p-1.5 rounded-lg" style={{color:C.red}}><Trash2 size={16}/></button>
        </div>
        <div className="mt-3 text-[12px] space-y-1.5" style={{color:C.ink2}}>
          <div className="flex items-center gap-1.5"><MapPin size={13} color={C.grey}/>{d.zones.join(" · ")||"no zones"}</div>
          <div className="flex items-center gap-1.5"><Calendar size={13} color={C.grey}/>{d.slots?.length?`${d.slots.length} slots/wk · ${daysOf(d.slots).join(", ")}`:"no availability set"}</div>
          <div className="flex items-center gap-1.5"><Users size={13} color={C.grey}/>{caseCount(d.name)} active case(s)</div>
          <div className="flex items-center gap-1.5"><Paperclip size={13} color={C.grey}/>{d.files?.length?d.files.join(", "):"no files / protocols"}</div>
        </div>
        <button onClick={()=>setEditing(editing===d.id?null:d.id)} className="mt-3 text-[12px] font-semibold flex items-center gap-1.5" style={{color:"#2E6E73"}}><Calendar size={13}/>{editing===d.id?"Done editing availability":"Edit availability"}</button>
        {editing===d.id&&<div className="mt-3 pt-3" style={{borderTop:`1px solid ${C.line}`}}>
          <SlotGrid slots={d.slots||[]} onToggle={k=>updateDoctorSlots(d.id,(d.slots||[]).includes(k)?d.slots.filter(x=>x!==k):[...(d.slots||[]),k])}/></div>}
      </div>))}
    </div>
  </>);
}

/* ---------- Finances (mirrors the Sessions Tracker · admin-only) ---------- */
function Finances({finances,updateFinance}){
  const[f,setF]=useState({from:"",to:"",doctor:"",status:"",method:""});
  const docOpts=[...new Set(finances.map(x=>x.doctor))];
  const src=finances.filter(x=>(!(f.from||f.to)||inRange(x.date,f.from,f.to))&&(!f.doctor||x.doctor===f.doctor)&&(!f.status||x.status===f.status)&&(!f.method||x.method===f.method));
  const rows=src.map(x=>({...x,docEarn:x.fee*x.pct,godoc:x.fee*(1-x.pct)}));
  const sum=k=>rows.reduce((a,r)=>a+r[k],0);
  const paid=rows.filter(r=>r.status==="Paid").length,pend=rows.filter(r=>r.status==="Pending").length;
  const byDoc=Object.values(rows.reduce((m,r)=>{(m[r.doctor]||=({doctor:r.doctor,sessions:0,rev:0,doc:0,go:0}));const o=m[r.doctor];o.sessions++;o.rev+=r.fee;o.doc+=r.docEarn;o.go+=r.godoc;return m;},{}));
  const cards=[["Sessions",rows.length,C.ink],["Revenue",egp(sum("fee")),C.ink],["Doctor earnings",egp(sum("docEarn")),"#2E6E73"],["Go Doc earnings",egp(sum("godoc")),C.green],["Paid",paid,C.green],["Pending",pend,C.amber]];
  const gt="90px 1.3fr 1.2fr 84px 78px 56px 92px 92px 108px 130px";
  return(<>
    <FilterBar onClear={()=>setF({from:"",to:"",doctor:"",status:"",method:""})}>
      <DateF value={f.from} onChange={v=>setF(s=>({...s,from:v}))} label="From"/>
      <DateF value={f.to} onChange={v=>setF(s=>({...s,to:v}))} label="To"/>
      <Sel value={f.doctor} onChange={v=>setF(s=>({...s,doctor:v}))} options={docOpts} label="Doctor"/>
      <Sel value={f.status} onChange={v=>setF(s=>({...s,status:v}))} options={PAY_STATUS} label="Payment"/>
      <Sel value={f.method} onChange={v=>setF(s=>({...s,method:v}))} options={PAY_METHOD} label="Method"/>
    </FilterBar>
    <div className="grid grid-cols-3 gap-3 mb-4">{cards.map(([l,v,c])=>(<div key={l} className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}><div className="text-[12px]" style={{color:C.grey}}>{l}</div><div className="text-[22px] font-bold mt-0.5" style={{color:c}}>{v}</div></div>))}</div>
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
        <h3 className="text-[13px] font-bold mb-3" style={{fontFamily:"Georgia,serif"}}>Revenue by doctor</h3>
        <ResponsiveContainer width="100%" height={160}><BarChart data={byDoc.map(d=>({name:d.doctor.split(" ")[1]||d.doctor,Doctor:d.doc,GoDoc:d.go}))}><XAxis dataKey="name" tick={{fontSize:11,fill:C.grey}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:C.grey}} axisLine={false} tickLine={false} width={36}/><Tooltip/><Bar dataKey="Doctor" stackId="a" fill="#2E6E73" radius={[0,0,0,0]}/><Bar dataKey="GoDoc" stackId="a" fill={C.green} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
      </div>
      <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
        <h3 className="text-[13px] font-bold mb-3" style={{fontFamily:"Georgia,serif"}}>Payment status</h3>
        <div className="flex items-center gap-4"><ResponsiveContainer width="55%" height={160}><PieChart><Pie data={PAY_STATUS.map(s=>({name:s,v:rows.filter(r=>r.status===s).length})).filter(x=>x.v)} dataKey="v" nameKey="name" innerRadius={40} outerRadius={64} paddingAngle={3}>{PAY_STATUS.map(s=><Cell key={s} fill={payColor[s]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
          <div className="space-y-1.5">{PAY_STATUS.map(s=>{const n=rows.filter(r=>r.status===s).length;return n?<div key={s} className="flex items-center gap-2 text-[12px]"><span className="w-3 h-3 rounded-sm" style={{background:payColor[s]}}/>{s}<b className="ml-1">{n}</b></div>:null;})}</div></div>
      </div>
    </div>
    <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{border:`1px solid ${C.line}`}}>
      <div className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider grid grid-cols-12 gap-2" style={{color:C.grey,background:"#F4F4F2"}}>
        <span className="col-span-4">Per-doctor breakdown</span><span className="col-span-2 text-right">Sessions</span><span className="col-span-2 text-right">Revenue</span><span className="col-span-2 text-right">Doctor</span><span className="col-span-2 text-right">Go Doc</span></div>
      {byDoc.map((d,i)=>(<div key={d.doctor} className="px-5 py-3 grid grid-cols-12 gap-2 text-[13px] items-center" style={{borderTop:i?`1px solid ${C.line}`:"none"}}>
        <span className="col-span-4 font-semibold">{d.doctor}</span><span className="col-span-2 text-right tabular-nums">{d.sessions}</span><span className="col-span-2 text-right tabular-nums">{egp(d.rev)}</span><span className="col-span-2 text-right tabular-nums" style={{color:"#2E6E73"}}>{egp(d.doc)}</span><span className="col-span-2 text-right tabular-nums" style={{color:C.green}}>{egp(d.go)}</span></div>))}
    </div>
    <div className="bg-white rounded-2xl overflow-x-auto" style={{border:`1px solid ${C.line}`}}>
      <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider grid gap-2 items-center" style={{color:C.grey,background:"#F4F4F2",gridTemplateColumns:gt,minWidth:"940px"}}>
        <span>Date</span><span>Doctor</span><span>Patient</span><span>Type</span><span className="text-right">Fee</span><span className="text-right">Dr %</span><span className="text-right">Dr earn</span><span className="text-right">Go Doc</span><span>Status</span><span>Method</span></div>
      {rows.map((r,i)=>(<div key={r.id} className="px-4 py-2.5 grid gap-2 items-center text-[12px]" style={{borderTop:i?`1px solid ${C.line}`:"none",gridTemplateColumns:gt,minWidth:"940px"}}>
        <span style={{color:C.grey}}>{r.date}</span><span className="font-semibold truncate">{r.doctor}</span><span className="truncate">{r.patient}</span><span style={{color:C.ink2}}>{r.type}</span>
        <input type="number" value={r.fee} onChange={e=>updateFinance(r.id,{fee:+e.target.value})} className="w-full px-1.5 py-1 rounded-md text-right tabular-nums outline-none" style={{border:`1px solid ${C.line}`}}/>
        <input type="number" value={Math.round(r.pct*100)} onChange={e=>updateFinance(r.id,{pct:Math.min(100,Math.max(0,+e.target.value))/100})} className="w-full px-1.5 py-1 rounded-md text-right tabular-nums outline-none" style={{border:`1px solid ${C.line}`}}/>
        <span className="text-right tabular-nums" style={{color:"#2E6E73"}}>{egp(r.docEarn)}</span>
        <span className="text-right tabular-nums" style={{color:C.green}}>{egp(r.godoc)}</span>
        <select value={r.status} onChange={e=>updateFinance(r.id,{status:e.target.value})} className="px-1.5 py-1 rounded-md text-[12px] outline-none font-semibold" style={{border:`1px solid ${C.line}`,color:payColor[r.status]}}>{PAY_STATUS.map(s=><option key={s} style={{color:C.ink}}>{s}</option>)}</select>
        <select value={r.method} onChange={e=>updateFinance(r.id,{method:e.target.value})} className="px-1.5 py-1 rounded-md text-[12px] outline-none" style={{border:`1px solid ${C.line}`}}>{PAY_METHOD.map(m=><option key={m}>{m}</option>)}</select>
      </div>))}
    </div>
    <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{color:C.grey}}><Wallet size={11}/>Fee + Doctor % are the only inputs per row (defaults 500 EGP · 60%). Doctor earning, Go Doc %, Go Doc earning and all totals auto-calc — exactly like your tracker. Every logged session drops in here automatically. Admin-only.</p>
  </>);
}

/* ---------- patient status menu (admin only) ---------- */
function StatusMenu({patient,onSet}){
  const[open,setOpen]=useState(false);const[picking,setPicking]=useState(null);const[note,setNote]=useState("");
  const opts=MANUAL_STATUS_OPTIONS.filter(s=>s!==patient.status);
  const confirm=()=>{if(picking){onSet(picking,note.trim()||null);setOpen(false);setPicking(null);setNote("");}};
  return(<div className="relative">
    <button onClick={()=>setOpen(o=>!o)} className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-semibold" style={{background:"rgba(255,255,255,0.12)",color:"#fff"}}><MoreHorizontal size={15}/>Set status</button>
    {open&&<><div className="fixed inset-0 z-40" onClick={()=>{setOpen(false);setPicking(null);setNote("");}}/>
      <div className="absolute right-0 mt-2 w-[280px] rounded-2xl z-50 p-3" style={{background:"#fff",border:`1px solid ${C.line}`,boxShadow:"0 12px 32px rgba(30,42,58,0.18)"}}>
        {!picking?<><div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:C.grey}}>Move to…</div>
          <div className="space-y-1">{opts.map(s=>(<button key={s} onClick={()=>setPicking(s)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[13px] hover:bg-gray-50" style={{color:C.ink}}>
            <span className="w-2.5 h-2.5 rounded-full" style={{background:statusColor[s]}}/>{STATUS_LABEL[s]}</button>))}</div></>
        :<><div className="flex items-center gap-2 mb-2"><button onClick={()=>{setPicking(null);setNote("");}}><ChevronLeft size={16} color={C.grey}/></button>
          <span className="text-[13px] font-semibold" style={{color:C.ink}}>{STATUS_LABEL[picking]}</span></div>
          <textarea autoFocus value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Reason · optional" className="w-full px-2.5 py-2 rounded-lg text-[13px] outline-none resize-none" style={{border:`1px solid ${C.line}`}}/>
          <button onClick={confirm} className="w-full mt-2 py-2 rounded-lg font-semibold text-white text-[13px]" style={{background:C.ink}}>Confirm</button></>}
      </div></>}
  </div>);
}

/* ---------- lifecycle timeline (status history) ---------- */
function LifecycleTimeline({history}){
  if(!history||history.length===0)return null;
  const fmt=iso=>{try{const d=new Date(iso);return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})+" · "+d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});}catch{return iso;}};
  return(<div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
    <div className="text-[11px] font-bold uppercase mb-3" style={{color:C.grey}}>Lifecycle</div>
    <div className="relative pl-5">
      <div className="absolute left-[5px] top-1 bottom-1 w-px" style={{background:C.line}}/>
      {history.slice().reverse().map((h,i)=>(<div key={i} className="relative pb-3.5 last:pb-0">
        <div className="absolute -left-[19px] top-0.5 w-3 h-3 rounded-full" style={{background:statusColor[h.to],border:`2px solid #fff`,boxShadow:`0 0 0 1.5px ${statusColor[h.to]}`}}/>
        <div className="text-[13px]" style={{color:C.ink}}>
          {h.from?<><span style={{color:C.grey}}>{STATUS_LABEL[h.from]||h.from} → </span><b>{STATUS_LABEL[h.to]||h.to}</b></>:<b>{STATUS_LABEL[h.to]||h.to}</b>}
        </div>
        <div className="text-[11px]" style={{color:C.grey}}>{fmt(h.at)} · by {h.by}</div>
        {h.note&&<div className="text-[12px] mt-0.5" style={{color:C.ink2}}>{h.note}</div>}
      </div>))}
    </div>
  </div>);
}

/* ---------- Patient full history + discharge report ---------- */
function PainTrend({data,height=170}){
  return(<ResponsiveContainer width="100%" height={height}><AreaChart data={data} margin={{top:6,right:8,left:-18,bottom:0}}>
    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.5}/><stop offset="100%" stopColor={C.teal} stopOpacity={0.04}/></linearGradient></defs>
    <XAxis dataKey="s" tick={{fontSize:11,fill:C.grey}} axisLine={false} tickLine={false}/>
    <YAxis domain={[0,10]} tick={{fontSize:11,fill:C.grey}} axisLine={false} tickLine={false} width={28}/>
    <Tooltip labelFormatter={(l,p)=>p?.[0]?.payload?.date||l}/>
    <Area type="monotone" dataKey="before" name="Pain before" stroke="#2E6E73" strokeWidth={2} fill="url(#pg)"/>
    <Area type="monotone" dataKey="after" name="Pain after" stroke={C.green} strokeWidth={2} fill="transparent"/>
  </AreaChart></ResponsiveContainer>);
}

function PatientFile({patient,notes,finances,visits,onClose,onDischarge,updatePatientStatus,role="admin"}){
  const hist=notes.filter(n=>n.patientId===patient.id).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const data=hist.map((n,i)=>({s:`S${i+1}`,date:n.date,before:n.painBefore,after:n.painAfter}));
  const sessions=hist.length, startPain=hist[0]?.painBefore??null, endPain=hist.length?hist[hist.length-1].painAfter:null;
  const improvePct=startPain?Math.round(((startPain-endPain)/startPain)*100):0;
  const allEx=[...new Set(hist.flatMap(n=>n.exercises||[]))], allMod=[...new Set(hist.flatMap(n=>n.modalities||[]))];
  const respMix=["better","same","mixed","worse"].map(k=>({name:k,v:hist.filter(n=>n.response===k).length})).filter(x=>x.v);
  const redFlags=hist.filter(n=>n.redFlag);
  const latestPlan=[...hist].reverse().find(n=>n.plan)?.plan;
  const upcoming=(visits||[]).filter(v=>v.patientId===patient.id&&v.status!=="completed");
  const myFin=(finances||[]).filter(f=>f.patient===patient.name).map(f=>({...f,docEarn:f.fee*f.pct,godoc:f.fee*(1-f.pct)}));
  const billed=myFin.reduce((a,r)=>a+r.fee,0), paidAmt=myFin.filter(r=>r.status==="Paid").reduce((a,r)=>a+r.fee,0), pendAmt=billed-paidAmt;
  const[mode,setMode]=useState("profile");const[sub,setSub]=useState("overview");
  const[tlType,setTlType]=useState("");const[open,setOpen]=useState(null);const[docs,setDocs]=useState(patient.files||[]);
  const[summary,setSummary]=useState(patient.discharge?.summary||"");
  const today=new Date().toISOString().slice(0,10);
  const rep=patient.discharge||{date:today,sessions,startPain,endPain,improvePct,summary,dx:patient.dx,trend:data,doctor:patient.doctor};
  const save=()=>{onDischarge({date:today,sessions,startPain,endPain,improvePct,summary,dx:patient.dx,trend:data,doctor:hist[0]?.doctorName||patient.doctor});setMode("report");};
  const SUBS=[["overview","Overview"],["sessions","Sessions"],["docs","Documents"],...(role==="admin"?[["finance","Finance"]]:[])];
  const Info=({label,value})=>(<div><div className="text-[11px]" style={{color:C.grey}}>{label}</div><div className="text-[13px] font-semibold" style={{color:C.ink}}>{value||"—"}</div></div>);

  return(<div className="fixed inset-0 z-40 flex justify-center overflow-y-auto py-6" style={{background:"rgba(30,42,58,0.5)"}}>
    <div className="w-full max-w-[840px] mx-4 rounded-3xl self-start" style={{background:C.bg}}>
      {/* header */}
      <div className="px-6 py-4 flex items-center justify-between rounded-t-3xl" style={{background:C.ink}}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[18px]" style={{background:C.tealSoft,color:C.ink}}>{patient.name[0]}</div>
          <div><h2 className="text-white text-[20px] font-bold leading-tight" style={{fontFamily:"Georgia,serif"}}>{patient.name}</h2>
            <div className="flex items-center gap-2 mt-0.5"><span className="text-[12px]" style={{color:C.tealSoft}}>{patient.dx?.label||"no dx"} · {patient.zone}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:statusColor[patient.status]+"44",color:"#fff"}}>{STATUS_LABEL[patient.status]||patient.status}</span></div></div>
        </div>
        <div className="flex items-center gap-2">
          {patient.phone&&<a href={`tel:${patient.phone}`} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"rgba(255,255,255,0.12)"}}><Phone size={16} color="#fff"/></a>}
          {patient.locUrl&&<a href={patient.locUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"rgba(255,255,255,0.12)"}}><MapPin size={16} color="#fff"/></a>}
          {role==="admin"&&updatePatientStatus&&patient.status!=="discharged"&&<StatusMenu patient={patient} onSet={(to,note)=>updatePatientStatus(patient.id,to,note)}/>}
          {role==="admin"&&(patient.status!=="discharged"
            ? <button onClick={()=>setMode("discharge")} className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-semibold" style={{background:C.teal,color:C.ink}}><LogOut size={15}/>Discharge</button>
            : <button onClick={()=>setMode("report")} className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-semibold" style={{background:C.teal,color:C.ink}}><FileText size={15}/>Report</button>)}
          {role==="doctor"&&patient.status==="discharged"&&<button onClick={()=>setMode("report")} className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-semibold" style={{background:C.teal,color:C.ink}}><FileText size={15}/>Report</button>}
          <button onClick={onClose}><X size={22} color="#fff"/></button>
        </div>
      </div>

      {/* sub-tab nav */}
      {mode==="profile"&&<div className="flex gap-1 px-4 py-2" style={{background:"#fff",borderBottom:`1px solid ${C.line}`}}>
        {SUBS.map(([k,l])=>(<button key={k} onClick={()=>setSub(k)} className="px-4 py-2 rounded-lg text-[13px] font-semibold" style={{background:sub===k?C.ink:"transparent",color:sub===k?"#fff":C.ink2}}>{l}</button>))}
      </div>}

      {/* ============ OVERVIEW ============ */}
      {mode==="profile"&&sub==="overview"&&<div className="p-6 space-y-4">
        {redFlags.length>0&&<div className="rounded-xl p-3.5 flex gap-2.5" style={{background:"#FDF3F1",border:`1px solid ${C.red}55`}}><AlertTriangle size={17} color={C.red}/><div className="text-[13px]" style={{color:C.ink2}}><b style={{color:C.red}}>{redFlags.length} red flag(s)</b> in history — latest: {redFlags[redFlags.length-1].redFlagNote||"reported"}</div></div>}
        <div className="bg-white rounded-2xl p-5 grid grid-cols-3 gap-y-3 gap-x-4" style={{border:`1px solid ${C.line}`}}>
          <Info label="Complaint" value={patient.complaint}/><Info label="Assigned doctor" value={patient.doctor}/><Info label="Phone" value={patient.phone}/>
          <Info label="Zone" value={patient.zone}/><Info label="Location" value={patient.locText}/><Info label="Next visit" value={upcoming[0]?(upcoming[0].date||upcoming[0].time):"none scheduled"}/>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[["Sessions",sessions,C.ink],["Start pain",startPain??"–",painColor(startPain||0)],["Now",endPain??"–",painColor(endPain||0)],["Improvement",`${improvePct}%`,C.green]].map(([l,v,c])=>(
            <div key={l} className="bg-white rounded-2xl p-3.5" style={{border:`1px solid ${C.line}`}}><div className="text-[12px]" style={{color:C.grey}}>{l}</div><div className="text-[22px] font-bold" style={{color:c}}>{v}</div></div>))}
        </div>
        <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
          <h3 className="text-[13px] font-bold mb-2" style={{fontFamily:"Georgia,serif"}}>Pain over sessions</h3>
          {sessions?<PainTrend data={data}/>:<p className="text-[13px]" style={{color:C.grey}}>No sessions logged yet.</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}><div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Response mix</div>
            {respMix.length?<div className="flex items-center gap-3"><ResponsiveContainer width="50%" height={120}><PieChart><Pie data={respMix} dataKey="v" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={3}>{respMix.map(s=><Cell key={s.name} fill={respColor[s.name]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
              <div className="space-y-1">{respMix.map(s=><div key={s.name} className="flex items-center gap-1.5 text-[12px] capitalize"><span className="w-2.5 h-2.5 rounded-sm" style={{background:respColor[s.name]}}/>{s.name}<b className="ml-0.5">{s.v}</b></div>)}</div></div>:<p className="text-[13px]" style={{color:C.grey}}>—</p>}</div>
          <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}><div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Interventions used</div>
            <div className="flex flex-wrap gap-1.5">{[...allEx,...allMod].map(e=><span key={e} className="text-[11px] px-2 py-1 rounded-lg" style={{background:"#F4FBFC",color:C.ink,border:`1px solid ${C.tealSoft}`}}>{e}</span>)}{!allEx.length&&!allMod.length&&<span className="text-[13px]" style={{color:C.grey}}>—</span>}</div></div>
        </div>
        <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}><div className="text-[11px] font-bold uppercase mb-1.5" style={{color:C.grey}}>Current plan</div><p className="text-[13px]" style={{color:C.ink2}}>{latestPlan||"No plan recorded yet."}</p>
          {patient.history&&<><div className="text-[11px] font-bold uppercase mt-3 mb-1.5" style={{color:C.grey}}>Past history</div><p className="text-[13px]" style={{color:C.ink2}}>{patient.history}</p></>}</div>
        <LifecycleTimeline history={patient.statusHistory||[]}/>
      </div>}

      {/* ============ SESSIONS (expandable) ============ */}
      {mode==="profile"&&sub==="sessions"&&<div className="p-6">
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${C.line}`}}>
          <div className="px-5 py-2.5 flex items-center justify-between" style={{background:"#F4F4F2"}}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{color:C.grey}}>{hist.length} sessions · tap to expand</span>
            <Sel value={tlType} onChange={setTlType} options={VISIT_TYPES} label="All types"/>
          </div>
          {hist.filter(n=>!tlType||n.type===tlType).slice().reverse().map(n=>{const o=open===n.id;return(
            <div key={n.id} style={{borderTop:`1px solid ${C.line}`}}>
              <button onClick={()=>setOpen(o?null:n.id)} className="w-full px-5 py-3 flex items-center gap-4 text-left">
                <span className="text-[12px] tabular-nums w-20" style={{color:C.grey}}>{n.date}</span>
                <span className="text-[12px] font-semibold w-24">{n.type}</span>
                <span className="flex items-center gap-1.5 text-[13px]"><span className="font-bold" style={{color:painColor(n.painBefore)}}>{n.painBefore}</span><ChevronRight size={12} color={C.grey}/><span className="font-bold" style={{color:painColor(n.painAfter)}}>{n.painAfter}</span></span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ml-auto" style={{background:respColor[n.response]+"22",color:respColor[n.response]}}>{n.response}</span>
                {n.redFlag&&<AlertTriangle size={14} color={C.red}/>}
                <ChevronRight size={15} color={C.grey} style={{transform:o?"rotate(90deg)":"none",transition:"transform .15s"}}/>
              </button>
              {o&&<div className="px-5 pb-4 space-y-1.5 text-[13px]" style={{color:C.ink2}}>
                <div><b>Doctor:</b> {n.doctorName}</div>
                {n.dx&&<div><b>Diagnosis:</b> {n.dx.code?`${n.dx.code} · `:""}{n.dx.label}</div>}
                {n.exercises?.length>0&&<div><b>Exercises:</b> {n.exercises.join(", ")}</div>}
                {n.modalities?.length>0&&<div><b>Modalities:</b> {n.modalities.join(", ")}</div>}
                {n.plan&&<div><b>Plan:</b> {n.plan}</div>}
                {n.nextSessionDate&&<div><b>Next session:</b> {n.nextSessionDate}</div>}
                {n.redFlag&&<div style={{color:C.red}}><b>Red flag:</b> {n.redFlagNote||"reported"}</div>}
              </div>}
            </div>);})}
          {!hist.length&&<div className="px-5 py-4 text-[13px]" style={{color:C.grey}}>No sessions yet.</div>}
        </div>
      </div>}

      {/* ============ DOCUMENTS ============ */}
      {mode==="profile"&&sub==="docs"&&<div className="p-6">
        <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
          <div className="flex items-center justify-between mb-3"><h3 className="text-[14px] font-bold" style={{fontFamily:"Georgia,serif"}}>Files & documents</h3>
            <button onClick={()=>setDocs(d=>[...d,`upload_${d.length+1}.pdf`])} className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-lg" style={{background:"#F4FBFC",color:C.ink,border:`1px dashed ${C.tealSoft}`}}><Plus size={14}/>Attach</button></div>
          {docs.length?<div className="space-y-2">{docs.map(f=><div key={f} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]" style={{background:"#F4F4F2",color:C.ink2}}><Paperclip size={14} color={C.grey}/>{f}</div>)}</div>
            :<p className="text-[13px]" style={{color:C.grey}}>No documents yet — referral letters, imaging, op notes go here.</p>}
        </div>
      </div>}

      {/* ============ FINANCE (admin) ============ */}
      {mode==="profile"&&sub==="finance"&&<div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[["Total billed",egp(billed),C.ink],["Paid",egp(paidAmt),C.green],["Outstanding",egp(pendAmt),C.amber]].map(([l,v,c])=>(
            <div key={l} className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}><div className="text-[12px]" style={{color:C.grey}}>{l}</div><div className="text-[20px] font-bold mt-0.5" style={{color:c}}>{v}</div></div>))}
        </div>
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${C.line}`}}>
          <div className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider grid grid-cols-12 gap-2" style={{color:C.grey,background:"#F4F4F2"}}>
            <span className="col-span-3">Date</span><span className="col-span-3">Type</span><span className="col-span-2 text-right">Fee</span><span className="col-span-2">Status</span><span className="col-span-2">Method</span></div>
          {myFin.map((r,i)=>(<div key={r.id} className="px-5 py-3 grid grid-cols-12 gap-2 text-[12px] items-center" style={{borderTop:i?`1px solid ${C.line}`:"none"}}>
            <span className="col-span-3" style={{color:C.grey}}>{r.date}</span><span className="col-span-3">{r.type}</span><span className="col-span-2 text-right tabular-nums">{egp(r.fee)}</span>
            <span className="col-span-2"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{background:payColor[r.status]+"22",color:payColor[r.status]}}>{r.status}</span></span>
            <span className="col-span-2" style={{color:C.ink2}}>{r.method}</span></div>))}
          {!myFin.length&&<div className="px-5 py-4 text-[13px]" style={{color:C.grey}}>No billed sessions yet.</div>}
        </div>
        <p className="text-[11px] flex items-center gap-1.5" style={{color:C.grey}}><Wallet size={11}/>Admin-only — edit fees in the Finances tab.</p>
      </div>}

      {/* ============ DISCHARGE FORM ============ */}
      {mode==="discharge"&&<div className="p-6 space-y-4">
        <div className="rounded-xl p-4 flex gap-3" style={{background:"#F4FBFC",border:`1px solid ${C.tealSoft}`}}><TrendingDown size={18} color="#2E6E73"/><p className="text-[13px]" style={{color:C.ink2}}>Outcome auto-computed: <b>{sessions} sessions</b>, pain <b>{startPain}→{endPain}</b> (<b>{improvePct}% improvement</b>). Add a closing summary below.</p></div>
        <Field label="Discharge summary & home plan"><textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={5} placeholder="Outcome achieved, residual issues, home exercise program, follow-up advice…" className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none resize-none bg-white" style={{border:`1px solid ${C.line}`}}/></Field>
        <div className="flex gap-2"><button onClick={()=>setMode("profile")} className="flex-1 py-3.5 rounded-xl font-semibold" style={{background:"#fff",color:C.ink,border:`1px solid ${C.line}`}}>Back</button>
          <button disabled={!summary.trim()} onClick={save} className="flex-1 py-3.5 rounded-xl font-bold text-white disabled:opacity-40" style={{background:C.ink}}>Generate discharge report</button></div>
      </div>}

      {/* ============ DISCHARGE REPORT ============ */}
      {mode==="report"&&<div className="p-6">
        <div className="bg-white rounded-2xl p-7" style={{border:`1px solid ${C.line}`}}>
          <div className="flex items-center justify-between pb-4" style={{borderBottom:`2px solid ${C.ink}`}}>
            <div><div className="text-[20px] font-bold" style={{fontFamily:"Georgia,serif",color:C.ink}}>Discharge Report</div><div className="text-[12px]" style={{color:C.grey}}>Go Doc — Home Physiotherapy</div></div>
            <div className="text-right text-[12px]" style={{color:C.grey}}>Discharged<br/><b style={{color:C.ink}}>{rep.date}</b></div>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 mt-4 text-[14px]">
            <div><span style={{color:C.grey}}>Patient: </span><b>{patient.name}</b></div>
            <div><span style={{color:C.grey}}>Treating doctor: </span><b>{rep.doctor||patient.doctor}</b></div>
            <div><span style={{color:C.grey}}>Diagnosis: </span><b>{rep.dx?`${rep.dx.code||""} ${rep.dx.label}`:"—"}</b></div>
            <div><span style={{color:C.grey}}>Total sessions: </span><b>{rep.sessions}</b></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[["Pain at start",rep.startPain,painColor(rep.startPain||0)],["Pain at discharge",rep.endPain,painColor(rep.endPain||0)],["Improvement",`${rep.improvePct}%`,C.green]].map(([l,v,c])=>(
              <div key={l} className="rounded-xl p-3.5 text-center" style={{background:"#F4F4F2"}}><div className="text-[11px]" style={{color:C.grey}}>{l}</div><div className="text-[26px] font-bold" style={{color:c}}>{v}</div></div>))}
          </div>
          <div className="mt-5"><div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:C.grey}}>Pain trajectory</div><PainTrend data={rep.trend||data} height={160}/></div>
          <div className="mt-5"><div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:C.grey}}>Summary & home plan</div><p className="text-[14px] whitespace-pre-wrap" style={{color:C.ink2}}>{rep.summary||summary||"—"}</p></div>
          <div className="mt-6 pt-4 text-[12px] flex justify-between" style={{borderTop:`1px solid ${C.line}`,color:C.grey}}><span>Signature: {rep.doctor||patient.doctor} ______________</span><span>© Go Doc</span></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={()=>setMode("profile")} className="flex-1 py-3 rounded-xl font-semibold" style={{background:"#fff",color:C.ink,border:`1px solid ${C.line}`}}>Back to profile</button>
          <button onClick={()=>window.print()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white" style={{background:C.ink}}><Printer size={16}/>Print / export PDF</button>
        </div>
      </div>}
    </div>
  </div>);
}

/* ---------- Library: exercises (enriched objects) + modalities ---------- */
function LibraryTab({exerciseLib,modalityLib,setExerciseLib,setModalityLib}){
  const[adding,setAdding]=useState(false);
  const[ne,setNe]=useState({name:"",dosageHint:"",position:"",description:"",notes:"",mediaUrl:""});
  const[md,setMd]=useState("");const[mp,setMp]=useState("");
  const[expanded,setExpanded]=useState(null);
  const save=()=>{if(!ne.name.trim())return;setExerciseLib(l=>[...l,{...ne,id:Date.now(),name:ne.name.trim()}]);setNe({name:"",dosageHint:"",position:"",description:"",notes:"",mediaUrl:""});setAdding(false);};
  return(<div className="grid grid-cols-2 gap-5">
    <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
      <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-[15px]" style={{fontFamily:"Georgia,serif"}}>Exercises</h3>
        <button onClick={()=>setAdding(a=>!a)} className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg" style={{background:adding?"#fff":C.ink,color:adding?C.ink:"#fff",border:`1px solid ${C.line}`}}>{adding?<X size={13}/>:<Plus size={13}/>}{adding?"Cancel":"Add"}</button></div>
      {adding&&<div className="mb-3 p-3 rounded-xl space-y-2" style={{background:"#F4FBFC",border:`1px solid ${C.tealSoft}`}}>
        <div className="grid grid-cols-2 gap-2"><input value={ne.name} onChange={e=>setNe(s=>({...s,name:e.target.value}))} placeholder="Exercise name *" className="px-3 py-2 rounded-lg text-[13px] outline-none bg-white" style={{border:`1px solid ${C.line}`}}/>
          <input value={ne.dosageHint} onChange={e=>setNe(s=>({...s,dosageHint:e.target.value}))} placeholder="Dosage hint · e.g. 3×15" className="px-3 py-2 rounded-lg text-[13px] outline-none bg-white" style={{border:`1px solid ${C.line}`}}/></div>
        <input value={ne.position} onChange={e=>setNe(s=>({...s,position:e.target.value}))} placeholder="Position / setup" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none bg-white" style={{border:`1px solid ${C.line}`}}/>
        <textarea value={ne.description} onChange={e=>setNe(s=>({...s,description:e.target.value}))} rows={2} placeholder="Description" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none bg-white resize-none" style={{border:`1px solid ${C.line}`}}/>
        <input value={ne.notes} onChange={e=>setNe(s=>({...s,notes:e.target.value}))} placeholder="Notes / cues" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none bg-white" style={{border:`1px solid ${C.line}`}}/>
        <input value={ne.mediaUrl} onChange={e=>setNe(s=>({...s,mediaUrl:e.target.value}))} placeholder="Photo / video URL" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none bg-white" style={{border:`1px solid ${C.line}`}}/>
        <button disabled={!ne.name.trim()} onClick={save} className="w-full py-2 rounded-lg font-semibold text-white text-[13px] disabled:opacity-40" style={{background:C.ink}}>Save exercise</button></div>}
      <div className="space-y-1.5 max-h-[460px] overflow-y-auto">{exerciseLib.map(e=>{const o=expanded===e.id;return(
        <div key={e.id} className="rounded-lg overflow-hidden" style={{background:"#F4F4F2"}}>
          <button onClick={()=>setExpanded(o?null:e.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
            <span className="text-[13px] font-semibold flex-1" style={{color:C.ink2}}>{e.name}</span>
            {e.dosageHint&&<span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{background:"#fff",color:"#2E6E73"}}>{e.dosageHint}</span>}
            <ChevronRight size={13} color={C.grey} style={{transform:o?"rotate(90deg)":"none",transition:"transform .15s"}}/>
          </button>
          {o&&<div className="px-3 pb-2.5 text-[12px] space-y-1" style={{color:C.ink2}}>
            {e.position&&<div><b>Position:</b> {e.position}</div>}
            {e.description&&<div><b>Description:</b> {e.description}</div>}
            {e.notes&&<div><b>Notes:</b> {e.notes}</div>}
            {e.mediaUrl&&<div><b>Media:</b> <a href={e.mediaUrl} target="_blank" rel="noreferrer" style={{color:"#2E6E73",textDecoration:"underline"}}>{e.mediaUrl}</a></div>}
          </div>}
        </div>);})}</div>
    </div>
    <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${C.line}`}}>
      <h3 className="font-bold text-[15px] mb-3" style={{fontFamily:"Georgia,serif"}}>Modalities</h3>
      <div className="space-y-1.5 mb-3 max-h-[460px] overflow-y-auto">{modalityLib.map(m=><div key={m.name} className="text-[13px] px-3 py-2 rounded-lg" style={{background:"#F4F4F2",color:C.ink2}}><b>{m.name}</b>{m.params&&<span style={{color:C.grey}}> · {m.params}</span>}</div>)}</div>
      <div className="flex gap-2"><input value={md} onChange={e=>setMd(e.target.value)} placeholder="Modality" className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none" style={{border:`1px solid ${C.line}`}}/>
        <input value={mp} onChange={e=>setMp(e.target.value)} placeholder="params" className="w-24 px-3 py-2 rounded-lg text-[13px] outline-none" style={{border:`1px solid ${C.line}`}}/>
        <button onClick={()=>{if(md.trim()){setModalityLib(l=>[...l,{name:md.trim(),params:mp.trim()}]);setMd("");setMp("");}}} className="px-3 rounded-lg text-white" style={{background:C.ink}}><Plus size={16}/></button></div>
    </div>
  </div>);
}

/* ---------- Settings: editable single-row config ---------- */
function SettingsTab({config,updateConfig}){
  const[draft,setDraft]=useState(config);
  const dirty=draft.defaultFee!==config.defaultFee||draft.defaultPct!==config.defaultPct||draft.currency!==config.currency;
  const save=()=>updateConfig(draft);
  return(<div className="max-w-[640px]">
    <div className="bg-white rounded-2xl p-6" style={{border:`1px solid ${C.line}`}}>
      <h3 className="font-bold text-[16px] mb-1" style={{fontFamily:"Georgia,serif"}}>Defaults</h3>
      <p className="text-[12px] mb-5" style={{color:C.grey}}>These values are applied when a new session is logged. Each row in Finances is editable individually — only future sessions pick up changes here.</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Default session fee">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white" style={{border:`1px solid ${C.line}`}}>
            <input type="number" value={draft.defaultFee} onChange={e=>setDraft(d=>({...d,defaultFee:+e.target.value||0}))} className="flex-1 outline-none text-[15px]"/>
            <span className="text-[12px] font-semibold" style={{color:C.grey}}>{draft.currency}</span>
          </div>
        </Field>
        <Field label="Default doctor share">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white" style={{border:`1px solid ${C.line}`}}>
            <input type="number" step="0.05" min="0" max="1" value={draft.defaultPct} onChange={e=>setDraft(d=>({...d,defaultPct:Math.max(0,Math.min(1,+e.target.value||0))}))} className="flex-1 outline-none text-[15px]"/>
            <span className="text-[12px] font-semibold" style={{color:C.grey}}>· {Math.round(draft.defaultPct*100)}% to doctor / {Math.round((1-draft.defaultPct)*100)}% to Go Doc</span>
          </div>
        </Field>
        <Field label="Currency">
          <select value={draft.currency} onChange={e=>setDraft(d=>({...d,currency:e.target.value}))} className="w-full px-3 py-2.5 rounded-xl text-[15px] outline-none bg-white" style={{border:`1px solid ${C.line}`,color:C.ink}}>
            {["EGP","USD","EUR","SAR","AED"].map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-5 pt-4 flex items-center justify-between" style={{borderTop:`1px solid ${C.line}`}}>
        <p className="text-[12px]" style={{color:dirty?C.amber:C.grey}}>{dirty?"Unsaved changes":"All saved"}</p>
        <div className="flex gap-2">
          <button onClick={()=>setDraft(config)} disabled={!dirty} className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40" style={{background:"#fff",color:C.ink2,border:`1px solid ${C.line}`}}>Reset</button>
          <button onClick={save} disabled={!dirty} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-40" style={{background:C.ink}}>Save</button>
        </div>
      </div>
    </div>
    <div className="bg-white rounded-2xl p-6 mt-4" style={{border:`1px solid ${C.line}`}}>
      <h3 className="font-bold text-[15px] mb-1" style={{fontFamily:"Georgia,serif"}}>Admin team</h3>
      <p className="text-[12px] mb-3" style={{color:C.grey}}>Accounts with full system access. Auth + RLS handled in the Supabase wiring layer — this is the source of truth for who's listed.</p>
      <div className="space-y-2">{[
        {name:"Omar Youssef",email:"oyoussef@godoc.site",role:"Founder · Medical Director"},
        {name:"M. Naguib",email:"mnaguib@godoc.site",role:"Operations"},
      ].map(a=>(<div key={a.email} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:"#F4F4F2"}}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[14px]" style={{background:C.tealSoft,color:C.ink}}>{a.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div>
        <div className="flex-1"><div className="text-[13px] font-semibold" style={{color:C.ink}}>{a.name}</div><div className="text-[11px]" style={{color:C.grey}}>{a.email} · {a.role}</div></div>
      </div>))}</div>
    </div>
  </div>);
}

/* ---------- Intake (full field set) ---------- */
function Intake({doctors,patients=[],onClose,onSave,onOpenExisting}){
  const[step,setStep]=useState(1);const[q,setQ]=useState("");
  const[f,setF]=useState({name:"",phone:"",complaint:"",history:"",files:[],zone:"",locText:"",locUrl:"",dx:null});
  const[dxOpen,setDxOpen]=useState(false);const[mode,setMode]=useState(null);const[date,setDate]=useState("");const[doctor,setDoctor]=useState(null);
  const set=k=>v=>setF(s=>({...s,[k]:v}));
  const norm=s=>(s||"").toLowerCase().replace(/\s+/g," ").trim();
  const digits=s=>(s||"").replace(/\D/g,"");
  const cand=useMemo(()=>doctors.map(d=>({...d,inZone:d.zones.includes(f.zone)})).sort((a,b)=>b.inZone-a.inZone),[f.zone,doctors]);
  const matches=useMemo(()=>{const t=norm(q),d=digits(q);if(t.length<2&&d.length<3)return[];
    return patients.filter(p=>(t.length>=2&&norm(p.name).includes(t))||(d.length>=3&&digits(p.phone).includes(d)));},[q,patients]);
  const dupPhone=useMemo(()=>digits(f.phone).length>=6?patients.find(p=>digits(p.phone)===digits(f.phone)):null,[f.phone,patients]);
  const dupName=useMemo(()=>norm(f.name)?patients.find(p=>norm(p.name)===norm(f.name)):null,[f.name,patients]);
  return(<div className="absolute inset-0 z-40 flex items-center justify-center p-5" style={{background:"rgba(30,42,58,0.5)"}}>
    <div className="relative w-full max-w-[480px] rounded-3xl overflow-hidden" style={{background:C.bg}}>
      <div className="px-5 py-4 flex items-center justify-between" style={{background:"#fff",borderBottom:`1px solid ${C.line}`}}>
        <div className="flex items-center gap-2">{step>1&&step<4&&<button onClick={()=>setStep(s=>s-1)}><ChevronLeft size={20}/></button>}<h2 className="text-[18px] font-bold" style={{fontFamily:"Georgia,serif"}}>New patient</h2></div>
        <button onClick={onClose}><X size={20} color={C.grey}/></button></div>
      {step<4&&<div className="flex gap-1.5 px-5 py-3" style={{background:"#fff"}}>{[1,2,3].map(s=><div key={s} className="flex-1 h-1.5 rounded-full" style={{background:step>=s?C.teal:C.line}}/>)}</div>}
      <div className="p-5 max-h-[66vh] overflow-y-auto">
        {step===1&&<><p className="text-[13px] mb-3" style={{color:C.grey}}>Search existing patients first — avoid duplicates.</p>
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-3" style={{border:`1px solid ${C.line}`}}><Search size={18} color={C.grey}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Phone or name…" className="flex-1 outline-none text-[15px]"/></div>
          {matches.length>0&&<div className="mt-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{color:C.amber}}><AlertTriangle size={12}/>{matches.length} existing match{matches.length>1?"es":""} — open instead of creating</div>
            {matches.map(p=>(<button key={p.id} onClick={()=>onOpenExisting&&onOpenExisting(p)} className="w-full text-left bg-white rounded-xl p-3 flex items-center justify-between" style={{border:`1px solid ${C.line}`}}>
              <div><div className="font-semibold flex items-center gap-2">{p.name}<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:statusColor[p.status]+"22",color:statusColor[p.status]}}>{STATUS_LABEL[p.status]||p.status}</span></div>
                <div className="text-[11px] flex items-center gap-2.5 mt-0.5" style={{color:C.grey}}><span className="flex items-center gap-1"><Phone size={10}/>{p.phone}</span><span>{p.zone}</span></div></div>
              <ChevronRight size={16} color={C.grey}/></button>))}
          </div>}
          {q.trim().length>=2&&<button onClick={()=>{const ph=/^\+?\d/.test(q.trim());setF(s=>({...s,name:ph?"":q.trim(),phone:ph?q.trim():""}));setStep(2);}} className="w-full mt-4 py-3.5 rounded-xl font-semibold" style={{background:matches.length?"#fff":C.ink,color:matches.length?C.ink:"#fff",border:`1px solid ${matches.length?C.line:C.ink}`}}>{matches.length?`None of these — create new “${q.trim()}”`:`Create “${q.trim()}”`}</button>}</>}
        {step===2&&<div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Field label="Name"><input value={f.name} onChange={e=>set("name")(e.target.value)} className={inp} style={{border:`1px solid ${dupName?C.amber:C.line}`}}/></Field>
            <Field label="Phone number"><input value={f.phone} onChange={e=>set("phone")(e.target.value)} className={inp} style={{border:`1px solid ${dupPhone?C.red:C.line}`}}/></Field></div>
          {dupPhone&&<button onClick={()=>onOpenExisting&&onOpenExisting(dupPhone)} className="w-full text-left rounded-xl p-3 flex gap-2 text-[13px]" style={{background:"#FDF3F1",border:`1px solid ${C.red}55`,color:C.ink2}}><AlertTriangle size={16} color={C.red} className="shrink-0 mt-0.5"/><div><b style={{color:C.red}}>This phone already belongs to {dupPhone.name}.</b> Tap to open that record — a new one can’t be created with the same number.</div></button>}
          {!dupPhone&&dupName&&<div className="rounded-xl p-3 flex gap-2 text-[13px]" style={{background:"#FFF8EC",border:`1px solid ${C.amber}66`,color:C.ink2}}><AlertTriangle size={16} color={C.amber} className="shrink-0 mt-0.5"/><div><b style={{color:"#9a6a00"}}>A patient named “{f.name}” already exists.</b> Different phone, so this may be a different person — double-check before continuing.</div></div>}
          <Field label="Complaint"><input value={f.complaint} onChange={e=>set("complaint")(e.target.value)} placeholder="e.g. low back pain" className={inp} style={{border:`1px solid ${C.line}`}}/></Field>
          <Field label="Past history" optional><textarea value={f.history} onChange={e=>set("history")(e.target.value)} rows={2} placeholder="Prior surgery, imaging…" className={inp+" resize-none"} style={{border:`1px solid ${C.line}`}}/></Field>
          <Field label="Files" optional><div className="flex flex-wrap items-center gap-2">{f.files.map(fn=><span key={fn} className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg" style={{background:"#fff",border:`1px solid ${C.line}`,color:C.ink2}}><Paperclip size={12}/>{fn}</span>)}
            <button onClick={()=>set("files")([...f.files,`scan_${f.files.length+1}.pdf`])} className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-lg font-semibold" style={{background:"#F4FBFC",color:C.ink,border:`1px dashed ${C.tealSoft}`}}><Plus size={14}/>Attach</button></div></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Zone (area)"><select value={f.zone} onChange={e=>set("zone")(e.target.value)} className={inp} style={{border:`1px solid ${C.line}`,color:f.zone?C.ink:C.grey}}><option value="">Select…</option>{ZONES.map(z=><option key={z}>{z}</option>)}</select></Field>
            <Field label="Map link" optional><div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white" style={{border:`1px solid ${C.line}`}}><Link2 size={15} color={C.grey}/><input value={f.locUrl} onChange={e=>set("locUrl")(e.target.value)} placeholder="maps.app.goo.gl/…" className="flex-1 outline-none text-[14px]"/></div></Field></div>
          <Field label="Location (written)" optional><input value={f.locText} onChange={e=>set("locText")(e.target.value)} placeholder="Street, building, floor" className={inp} style={{border:`1px solid ${C.line}`}}/></Field>
          <div className="bg-white rounded-xl p-3" style={{border:`1px solid ${f.dx?C.teal:C.line}`}}>
            <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-bold uppercase" style={{color:C.grey}}>Primary diagnosis <span style={{color:C.amber}}>· optional</span></span>{f.dx&&<button onClick={()=>set("dx")(null)} className="text-[12px]" style={{color:C.grey}}>Remove</button>}</div>
            {f.dx?<button onClick={()=>setDxOpen(true)} className="flex items-center gap-2 text-[14px]"><span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{background:"#EAF6F7",color:"#2E6E73"}}>{f.dx.code||"free"}</span>{f.dx.label}</button>
              :<button onClick={()=>setDxOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold" style={{background:"#F4FBFC",color:C.ink,border:`1px dashed ${C.tealSoft}`}}><Plus size={15}/>Add — or skip, doctor adds at 1st visit</button>}</div>
          <button disabled={!f.name||!f.phone||!f.complaint||!!dupPhone} onClick={()=>setStep(3)} className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-40" style={{background:C.ink}}>{dupPhone?"Duplicate phone — resolve above":"Continue"}</button>
        </div>}
        {step===3&&<><div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={()=>setMode("book")} className="p-4 rounded-2xl text-left" style={{background:mode==="book"?"#F4FBFC":"#fff",border:`1.5px solid ${mode==="book"?C.teal:C.line}`}}><Calendar size={20} color={C.green}/><div className="font-bold mt-2">Book 1st visit</div><div className="text-[11px]" style={{color:C.grey}}>Assessment</div></button>
          <button onClick={()=>setMode("lead")} className="p-4 rounded-2xl text-left" style={{background:mode==="lead"?"#F4FBFC":"#fff",border:`1.5px solid ${mode==="lead"?C.teal:C.line}`}}><Clock size={20} color={C.amber}/><div className="font-bold mt-2">Just a lead</div></button></div>
          {mode==="book"&&<><Field label="Date of 1st visit"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp} style={{border:`1px solid ${C.line}`,color:date?C.ink:C.grey}}/></Field>
            <div className="mt-3"><span className="text-[12px] font-semibold" style={{color:C.ink2}}>Assign doctor · {f.zone||"zone not set"} first</span>
              <div className="space-y-2 mt-1.5">{cand.map(d=>{const on=doctor===d.name;return(<button key={d.id} onClick={()=>setDoctor(d.name)} className="w-full text-left p-3 rounded-xl flex items-center justify-between" style={{background:on?"#F4FBFC":"#fff",border:`1.5px solid ${on?C.teal:C.line}`}}>
                <div><div className="font-bold text-[14px]" style={{color:C.ink}}>{d.name}</div><div className="text-[12px]" style={{color:C.grey}}>{d.spec} · {d.slots?.length?[...new Set(d.slots.map(s=>s.split("-")[0]))].join(", "):"no slots"}</div></div>
                <div className="flex items-center gap-2">{d.inZone&&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{background:C.green+"22",color:C.green}}><MapPin size={10}/>zone</span>}{on&&<CircleCheck size={18} color={C.teal}/>}</div></button>);})}</div></div></>}
          <button disabled={!mode||!!dupPhone||(mode==="book"&&(!date||!doctor))} onClick={()=>{onSave(f,mode==="book",date,doctor);}} className="w-full mt-4 py-3.5 rounded-xl font-semibold text-white disabled:opacity-40" style={{background:C.ink}}>{mode==="book"?"Create & book":"Save lead"}</button></>}
      </div>
      <DxSheet open={dxOpen} onClose={()=>setDxOpen(false)} onPick={v=>set("dx")(v)}/>
    </div></div>);
}

/* =============================== DOCTOR =============================== */
function Doctor({patients,visits,notes,me,doctors,exerciseLib,modalityLib,submitNote,updateDoctorSlots,updateDoctorZones,notifs,markRead}){
  const[active,setActive]=useState(null);const[picker,setPicker]=useState(false);const[tab,setTab]=useState("visits");const[viewP,setViewP]=useState(null);
  const mine=visits.filter(v=>v.doctorName===me&&v.status!=="completed");
  const myPatients=patients.filter(p=>p.doctor===me);
  const meDoc=doctors?.find(d=>d.name===me);
  const mySlots=meDoc?.slots||[];
  const myDays=[...new Set(mySlots.map(s=>s.split("-")[0]))];
  const toggleSlot=k=>meDoc&&updateDoctorSlots(meDoc.id,mySlots.includes(k)?mySlots.filter(x=>x!==k):[...mySlots,k],"doctor");
  const myZones=meDoc?.zones||[];
  const toggleZone=z=>meDoc&&updateDoctorZones(meDoc.id,myZones.includes(z)?myZones.filter(x=>x!==z):[...myZones,z],"doctor");
  const pOf=id=>patients.find(p=>p.id===id);
  const startSession=(p)=>{setPicker(false);setActive({visit:{id:Date.now(),patientId:p.id,doctorName:me,type:"Treatment",time:"now"},patient:p});};
  return(<div className="relative w-full max-w-[430px] min-h-screen" style={{background:C.bg}}>
    {!active?<>
      <div className="px-5 pt-8 pb-5" style={{background:C.ink}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:C.teal}}><Stethoscope size={18} color={C.ink}/></div>
            <div><h1 className="text-white text-[18px] font-bold" style={{fontFamily:"Georgia,serif"}}>{me}</h1><p className="text-[12px]" style={{color:C.tealSoft}}>{mine.length} upcoming · {mySlots.length} slots/wk</p></div></div>
          <NotifBell items={(notifs||[]).filter(n=>n.target==="doctor"&&(!n.to||n.to===me))} onOpen={()=>markRead&&markRead("doctor",me)} dark/>
        </div>
        <div className="flex gap-1.5 mt-4">
          {[["visits","My visits"],["patients","Patients"],["avail","Availability"]].map(([k,l])=>(<button key={k} onClick={()=>setTab(k)} className="flex-1 py-2 rounded-xl text-[13px] font-bold" style={{background:tab===k?C.teal:"rgba(255,255,255,0.1)",color:tab===k?C.ink:"#fff"}}>{l}</button>))}
        </div>
        {tab==="visits"&&<button onClick={()=>setPicker(true)} className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-[14px]" style={{background:"#fff",color:C.ink}}><Plus size={16}/>Log a session</button>}
      </div>

      {tab==="visits"&&<div className="p-4">{mine.length===0&&<p className="text-[13px] text-center mt-6" style={{color:C.grey}}>No upcoming visits — tap “Log a session” to log one independently.</p>}
        {mine.map(v=>{const p=pOf(v.patientId);return(<button key={v.id} onClick={()=>setActive({visit:v,patient:p})} className="w-full bg-white rounded-2xl p-4 mb-3 text-left" style={{border:`1px solid ${C.line}`}}>
          <div className="flex items-center gap-2"><Clock size={14} color={C.teal}/><span className="font-bold">{v.date||v.time}</span><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{background:v.type==="Assessment"?C.teal+"33":"#F0F0EE",color:C.ink2}}>{v.type}</span></div>
          <div className="text-[17px] font-bold mt-1.5" style={{fontFamily:"Georgia,serif",color:C.ink}}>{p?.name}</div>
          <div className="text-[13px] flex items-center gap-1.5 mt-0.5" style={{color:C.grey}}><MapPin size={13}/>{p?.zone} · {p?.dx?.label||"no dx yet"}</div></button>);})}</div>}

      {tab==="patients"&&<div className="p-4">{myPatients.length===0&&<p className="text-[13px] text-center mt-6" style={{color:C.grey}}>No patients assigned to you yet.</p>}
        {myPatients.map(p=>{const h=notes.filter(n=>n.patientId===p.id);const last=h.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).slice(-1)[0];return(
          <button key={p.id} onClick={()=>setViewP(p)} className="w-full bg-white rounded-2xl p-4 mb-3 text-left" style={{border:`1px solid ${C.line}`}}>
            <div className="flex items-center justify-between">
              <div className="text-[16px] font-bold" style={{fontFamily:"Georgia,serif",color:C.ink}}>{p.name}</div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:statusColor[p.status]+"22",color:statusColor[p.status]}}>{STATUS_LABEL[p.status]||p.status}</span></div>
            <div className="text-[12px] flex items-center gap-1.5 mt-0.5" style={{color:C.grey}}><MapPin size={12}/>{p.zone} · {p.dx?.label||"no dx yet"}</div>
            <div className="flex items-center gap-3 mt-2 text-[12px]" style={{color:C.ink2}}>
              <span className="flex items-center gap-1"><History size={12} color={C.teal}/>{h.length} session{h.length!==1?"s":""}</span>
              {last&&<span style={{color:C.grey}}>last {last.date}</span>}
              <span className="ml-auto flex items-center gap-0.5 font-semibold" style={{color:C.teal}}>View history<ChevronRight size={14}/></span></div>
          </button>);})}</div>}

      {tab==="avail"&&<div className="p-4 space-y-4">
        {!meDoc&&<p className="text-[13px]" style={{color:C.grey}}>Your doctor profile isn’t set up yet — ask the admin to add you.</p>}
        {meDoc&&<>
          <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
            <div className="flex items-center gap-2 mb-1"><Calendar size={15} color={C.teal}/><h3 className="text-[14px] font-bold" style={{fontFamily:"Georgia,serif"}}>Weekly availability</h3></div>
            <p className="text-[12px] mb-3" style={{color:C.grey}}>Tap the times you’re available to visit patients. Changes save instantly and the admin sees them live.</p>
            <SlotGrid slots={mySlots} onToggle={toggleSlot}/>
            <div className="flex items-center justify-between mt-3 pt-3 text-[12px]" style={{borderTop:`1px solid ${C.line}`,color:C.grey}}>
              <span>{myDays.length} day(s) · {mySlots.length} slots / week</span>
              {mySlots.length>0&&<button onClick={()=>updateDoctorSlots(meDoc.id,[],"doctor")} className="font-semibold" style={{color:C.red}}>Clear all</button>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:C.grey}}>Coverage zones</div>
            <p className="text-[12px] mb-3" style={{color:C.grey}}>Tap the zones you cover. Changes save instantly and the admin sees them live.</p>
            <div className="flex flex-wrap gap-1.5">{ZONES.map(z=>{const on=myZones.includes(z);return(
              <button key={z} type="button" onClick={()=>toggleZone(z)} className="text-[12px] px-2.5 py-1 rounded-lg font-semibold" style={{background:on?C.teal:"#F4FBFC",color:on?C.ink:C.ink,border:`1px solid ${on?C.teal:C.tealSoft}`}}>{z}</button>);})}</div>
            <div className="flex items-center justify-between mt-3 pt-3 text-[12px]" style={{borderTop:`1px solid ${C.line}`,color:C.grey}}>
              <span>{myZones.length} zone(s) covered</span>
              {myZones.length>0&&<button onClick={()=>updateDoctorZones(meDoc.id,[],"doctor")} className="font-semibold" style={{color:C.red}}>Clear all</button>}
            </div>
          </div>
        </>}
      </div>}

      {picker&&<div className="absolute inset-0 z-40 flex items-end" style={{background:"rgba(30,42,58,0.5)"}} onClick={()=>setPicker(false)}>
        <div className="w-full rounded-t-3xl p-5" style={{background:C.bg}} onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3"><h3 className="text-[16px] font-bold" style={{fontFamily:"Georgia,serif"}}>Log a session for…</h3><button onClick={()=>setPicker(false)}><X size={20} color={C.grey}/></button></div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {myPatients.map(p=>(<button key={p.id} onClick={()=>startSession(p)} className="w-full text-left bg-white rounded-xl p-3.5 flex items-center justify-between" style={{border:`1px solid ${C.line}`}}>
              <div><div className="font-semibold">{p.name}</div><div className="text-[12px]" style={{color:C.grey}}>{p.zone} · {p.dx?.label||"no dx"}</div></div><ChevronRight size={16} color={C.grey}/></button>))}
            {myPatients.length===0&&<p className="text-[13px]" style={{color:C.grey}}>No patients assigned to you yet.</p>}
          </div>
        </div></div>}
      {viewP&&<PatientFile patient={patients.find(p=>p.id===viewP.id)||viewP} notes={notes} finances={[]} visits={visits} role="doctor" onClose={()=>setViewP(null)} onDischarge={()=>{}}/>}
    </>:<Logger ctx={active} notes={notes} exerciseLib={exerciseLib} modalityLib={modalityLib} onBack={()=>setActive(null)} onSubmit={n=>{submitNote(n);setActive(null);}}/>}
  </div>);
}

function Logger({ctx,notes,exerciseLib,modalityLib,onBack,onSubmit}){
  const{visit,patient}=ctx;const isAssess=visit.type==="Assessment";
  /* seamless data flow: prefill follow-up from latest assessment note for this patient */
  const lastAssess=useMemo(()=>notes.filter(n=>n.patientId===patient.id&&n.type==="Assessment").slice(-1)[0],[notes,patient.id]);
  const[pb,setPb]=useState(null),[pa,setPa]=useState(null),[resp,setResp]=useState(null);
  const[ex,setEx]=useState({}),[mod,setMod]=useState({}),[rf,setRf]=useState(false),[rfn,setRfn]=useState("");
  const[dx,setDx]=useState(patient.dx||lastAssess?.dx||null),[sheet,setSheet]=useState(false);
  const[plan,setPlan]=useState(lastAssess?.plan||"");
  const[customEx,setCustomEx]=useState([]),[newEx,setNewEx]=useState(""),[nextDate,setNextDate]=useState("");
  const can=isAssess?!!dx:(pb!=null&&resp);
  return(<div className="pb-32">
    <div className="px-4 pt-8 pb-3" style={{background:C.ink}}>
      <button onClick={onBack} style={{color:"#fff"}}><ChevronLeft size={22}/></button>
      <h1 className="text-white text-[20px] font-bold mt-1" style={{fontFamily:"Georgia,serif"}}>{patient.name}</h1>
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{background:C.teal,color:C.ink}}>{visit.type}</span></div>
    <div className="px-4 pt-4 space-y-3">
      {!isAssess&&lastAssess&&<div className="rounded-xl px-3.5 py-2.5 flex gap-2" style={{background:"#F4FBFC",border:`1px solid ${C.tealSoft}`}}><Activity size={15} color="#2E6E73" className="flex-shrink-0 mt-0.5"/><p className="text-[12px]" style={{color:C.ink2}}>Carried from assessment: <b>{lastAssess.dx?.label||"dx"}</b>. No need to re-enter.</p></div>}
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${dx?C.teal:C.line}`}}>
        <div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Diagnosis{isAssess&&!dx&&<span style={{color:C.amber}}> · required at assessment</span>}</div>
        {dx?<button onClick={()=>setSheet(true)} className="flex items-center gap-2 text-[15px]"><span className="text-[11px] font-bold px-2 py-1 rounded" style={{background:"#EAF6F7",color:"#2E6E73"}}>{dx.code||"free"}</span>{dx.label}<Pencil size={14} color={C.grey}/></button>
          :<button onClick={()=>setSheet(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold" style={{background:"#F4FBFC",color:C.ink,border:`1px dashed ${C.tealSoft}`}}><Plus size={16}/>Add diagnosis</button>}</div>
      {[["Pain before",pb,setPb],["Pain after",pa,setPa]].map(([l,val,set])=>(<div key={l} className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="flex justify-between items-baseline mb-2"><span className="text-[13px] font-semibold" style={{color:C.ink2}}>{l}</span><span className="text-[20px] font-bold" style={{color:val==null?C.line:painColor(val)}}>{val==null?"–":val}</span></div>
        <div className="grid grid-cols-11 gap-1">{Array.from({length:11}).map((_,n)=><button key={n} onClick={()=>set(n)} className="h-9 rounded-md text-[12px] font-semibold" style={{background:val===n?painColor(n):"#fff",color:val===n?"#fff":C.ink2,border:`1px solid ${val===n?painColor(n):C.line}`}}>{n}</button>)}</div></div>))}
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Exercises done</div>
        <div className="space-y-2">{[...exerciseLib.map(e=>({name:e.name,hint:e.dosageHint||"",lib:true})),...customEx.map(c=>({name:c,hint:"",lib:false}))].map(e=>{const label=e.hint?`${e.name} · ${e.hint}`:e.name;const on=!!ex[label];return(<button key={label} onClick={()=>setEx(d=>({...d,[label]:!d[label]}))} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={{border:`1px solid ${on?C.teal:C.line}`,background:on?"#F4FBFC":"#fff"}}>
          <span className="w-5 h-5 rounded flex items-center justify-center" style={{background:on?C.teal:"#fff",border:`1px solid ${on?C.teal:C.line}`}}>{on&&<Check size={13} color={C.ink} strokeWidth={3}/>}</span>
          <span className="text-[13px] flex-1">{e.name}</span>
          {e.hint&&<span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{background:on?"#fff":"#F4F4F2",color:"#2E6E73"}}>{e.hint}</span>}</button>);})}</div>
        <div className="flex gap-2 mt-2"><input value={newEx} onChange={e=>setNewEx(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){const v=newEx.trim();if(v){setCustomEx(c=>[...c,v]);setEx(d=>({...d,[v]:true}));setNewEx("");}}}} placeholder="Add an exercise we want…" className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none" style={{border:`1px solid ${C.line}`}}/>
          <button onClick={()=>{const v=newEx.trim();if(v){setCustomEx(c=>[...c,v]);setEx(d=>({...d,[v]:true}));setNewEx("");}}} className="px-3 rounded-lg text-white" style={{background:C.ink}}><Plus size={16}/></button></div></div>
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Modalities</div>
        <div className="flex flex-wrap gap-2">{modalityLib.map(m=>{const on=!!mod[m.name];return(<button key={m.name} onClick={()=>setMod(d=>({...d,[m.name]:!d[m.name]}))} className="px-3 py-2 rounded-xl text-left" style={{border:`1px solid ${on?C.teal:C.line}`,background:on?"#F4FBFC":"#fff"}}>
          <div className="text-[13px] font-semibold flex items-center gap-1.5">{on&&<Check size={13} color={C.teal} strokeWidth={3}/>}{m.name}</div>{m.params&&<div className="text-[11px]" style={{color:C.grey}}>{m.params}</div>}</button>);})}</div></div>
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Response</div>
        <div className="grid grid-cols-4 gap-2">{["better","same","mixed","worse"].map(k=><button key={k} onClick={()=>setResp(k)} className="py-2.5 rounded-xl text-[12px] font-semibold capitalize" style={{background:resp===k?respColor[k]:"#fff",color:resp===k?"#fff":C.ink2,border:`1px solid ${resp===k?respColor[k]:C.line}`}}>{k}</button>)}</div></div>
      {isAssess&&<div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Plan</div>
        <textarea value={plan} onChange={e=>setPlan(e.target.value)} rows={2} placeholder="Program / progression — carries to follow-ups" className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none resize-none" style={{border:`1px solid ${C.line}`}}/></div>}
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="text-[11px] font-bold uppercase mb-2" style={{color:C.grey}}>Next session</div>
        <input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[15px] outline-none bg-white" style={{border:`1px solid ${C.line}`,color:nextDate?C.ink:C.grey}}/>
        <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{color:C.grey}}><Calendar size={12}/>Schedules the upcoming session for this patient.</p></div>
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${C.line}`}}>
        <div className="flex items-center justify-between"><span className="text-[14px] font-semibold" style={{color:C.ink2}}>Red flag?</span>
          <button onClick={()=>setRf(!rf)} className="w-12 h-7 rounded-full p-1" style={{background:rf?C.red:C.line}}><span className="block w-5 h-5 rounded-full bg-white" style={{transform:rf?"translateX(20px)":"none",transition:"transform .15s"}}/></button></div>
        {rf&&<textarea value={rfn} onChange={e=>setRfn(e.target.value)} autoFocus rows={2} placeholder="Describe — escalates to admin" className="w-full mt-3 px-3 py-2.5 rounded-xl text-[14px] outline-none resize-none" style={{border:`1px solid ${C.red}`,background:"#FDF3F1"}}/>}</div>
    </div>
    <div className="fixed bottom-0 w-full max-w-[430px] px-4 pt-3 pb-5" style={{background:`linear-gradient(to top, ${C.bg} 75%, transparent)`}}>
      <button disabled={!can} onClick={()=>onSubmit({visitId:visit.id,patientId:patient.id,patientName:patient.name,doctorName:visit.doctorName,type:visit.type,
        painBefore:pb??0,painAfter:pa??0,response:resp||"same",exercises:Object.keys(ex).filter(k=>ex[k]),modalities:Object.keys(mod).filter(k=>mod[k]),plan,nextSessionDate:nextDate,redFlag:rf,redFlagNote:rfn,dx})}
        className="w-full py-4 rounded-2xl font-bold text-[15px] text-white" style={{background:can?C.ink:"#C9CDD2",boxShadow:can?"0 8px 20px rgba(30,42,58,0.25)":"none"}}>
        {can?"Complete & submit for review":isAssess?"Add diagnosis to submit":"Log pain + response"}</button></div>
    <DxSheet open={sheet} onClose={()=>setSheet(false)} onPick={setDx}/>
  </div>);
}
