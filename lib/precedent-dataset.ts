export type CuratedPrecedent = {
  id: string;
  caseName: string;
  year: number;
  principle: string;
  category: string[];
  tags: string[];
  bailPosture?: string;
  proceduralStage?: string[];
  provenance: "curated";
  sourceUrl?: string;
};

/**
 * The authoritative precedent corpus for JuriSight.
 * Keep propositions and source URLs limited to material already approved for the product.
 */
export const PRECEDENT_DATASET: readonly CuratedPrecedent[] = [
  {
    id: "balchand-1977",
    caseName: "State of Rajasthan v. Balchand",
    year: 1977,
    principle: "Bail is the rule and jail is the exception, subject to the facts and risks of the case.",
    category: ["general bail", "non-bailable offences"],
    tags: ["bail rule", "personal liberty", "seriousness of offence", "regular bail"],
    bailPosture: "regular bail",
    proceduralStage: ["investigation", "trial", "post-arrest"],
    provenance: "curated",
  },
  {
    id: "hussainara-khatoon-1979",
    caseName: "Hussainara Khatoon v. State of Bihar",
    year: 1979,
    principle: "An undertrial's right to a speedy trial is part of the protection of personal liberty.",
    category: ["speedy trial", "prolonged custody"],
    tags: ["delay", "undertrial", "prolonged custody", "regular bail", "personal liberty"],
    bailPosture: "regular bail",
    proceduralStage: ["trial", "post-arrest"],
    provenance: "curated",
  },
  {
    id: "sanjay-chandra-2012",
    caseName: "Sanjay Chandra v. CBI",
    year: 2012,
    principle: "Pre-trial detention should not become punitive merely because an economic offence is serious, especially where trial may take time.",
    category: ["economic offences", "regular bail"],
    tags: ["economic offence", "financial offence", "trial delay", "seriousness of offence", "regular bail", "post-arrest"],
    bailPosture: "regular bail",
    proceduralStage: ["investigation", "trial", "post-arrest"],
    provenance: "curated",
  },
  {
    id: "arnesh-kumar-2014",
    caseName: "Arnesh Kumar v. State of Bihar",
    year: 2014,
    principle: "Arrest and detention should not be automatic; the statutory conditions and necessity of arrest must be considered.",
    category: ["arrest and detention", "non-bailable offences"],
    tags: ["arrest concerns", "detention concerns", "cooperation", "anticipatory bail", "regular bail", "investigation"],
    bailPosture: "anticipatory or regular bail",
    proceduralStage: ["investigation", "pre-arrest", "post-arrest"],
    provenance: "curated",
  },
  {
    id: "dataram-singh-2018",
    caseName: "Dataram Singh v. State of Uttar Pradesh",
    year: 2018,
    principle: "Presumption of innocence and a first-time offender's circumstances are relevant to the bail decision.",
    category: ["general bail", "first-time offenders"],
    tags: ["first-time offender", "no prior record", "presumption of innocence", "regular bail", "personal liberty"],
    bailPosture: "regular bail",
    proceduralStage: ["investigation", "trial", "post-arrest"],
    provenance: "curated",
  },
  {
    id: "pepsi-foods-1998",
    caseName: "Pepsi Foods Ltd. v. Special Judicial Magistrate",
    year: 1998,
    principle: "Issuing criminal process requires application of judicial mind because criminal proceedings have serious consequences.",
    category: ["criminal process", "procedural safeguards"],
    tags: ["criminal intent", "civil dispute", "process concerns", "pre-arrest", "anticipatory bail"],
    bailPosture: "anticipatory bail",
    proceduralStage: ["pre-arrest", "complaint"],
    provenance: "curated",
  },
];

