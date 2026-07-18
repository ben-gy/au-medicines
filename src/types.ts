export interface Drug {
  id: string;
  name: string;
  atc1: string;
  atc2: string;
  atc5: string;
  /** Total prescriptions supplied across the whole window. */
  scripts: number;
  /** PBS/RPBS subsidy paid by the Commonwealth, dollars. */
  govt: number;
  /** Actual dollars paid by patients (PATIENT_NET_CONTRIB), dollars. */
  patient: number;
  /** govt + patient. */
  total: number;
  /** Total cost per prescription. */
  cps: number;
  /** Share of scripts dispensed below the co-payment (no government benefit). */
  underShare: number;
  /** Number of distinct PBS item codes rolled into this medicine. */
  items: number;
  /** Monthly scripts, dense, aligned to meta.months. */
  ms: number[];
  /** Monthly government contribution. */
  mg: number[];
  /** Monthly patient contribution. */
  mp: number[];
}

export interface Meta {
  generated: string;
  months: string[];
  monthLabels: string[];
  drugCount: number;
  itemCount: number;
  rowCount: number;
  totals: { scripts: number; govt: number; patient: number; total: number };
  sources: { name: string; url: string }[];
  sourcePage: string;
}

export interface Labels {
  atc1: Record<string, string>;
  atc2: Record<string, string>;
  patientCat: Record<string, string>;
  pharmacy: Record<string, string>;
  drugType: Record<string, string>;
}

export interface Cell {
  scripts: number;
  govt: number;
  patient: number;
}

export interface Monthly {
  months: string[];
  byAtc1: Record<string, { scripts: number[]; govt: number[]; patient: number[] }>;
}

export type Matrix = Record<string, Record<string, Cell>>;

export interface Breakdown {
  key: string;
  label: string;
  scripts: number;
  govt: number;
  patient: number;
}

export interface DrugDetail {
  id: string;
  name: string;
  patientCat: Breakdown[];
  pharmacy: Breakdown[];
  drugType: Breakdown[];
  items: { code: string; form: string; atc5: string; scripts: number; govt: number; patient: number }[];
}

export interface Dataset {
  meta: Meta;
  drugs: Drug[];
  labels: Labels;
  monthly: Monthly;
  matrix: Matrix;
  byId: Map<string, Drug>;
}

/** The metric a view is currently ranking or sizing by. */
export type Metric = 'total' | 'govt' | 'patient' | 'scripts' | 'cps';
