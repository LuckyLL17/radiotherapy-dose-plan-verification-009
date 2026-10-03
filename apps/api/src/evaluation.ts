export type ConstraintMetric = 'D95' | 'Dmax' | 'V20';
export type StructureType = 'target' | 'organ';

export interface ConstraintDefinition {
  metric: ConstraintMetric;
  limit: number;
  unit: string;
}

export interface ConstraintSubject {
  id: string;
  name: string;
  type: StructureType;
  volume: number;
  constraint: ConstraintDefinition;
}

export interface ConstraintCheck {
  structureId: string;
  name: string;
  metric: ConstraintMetric;
  value: number;
  limit: number;
  unit: string;
  pass: boolean;
  delta: number;
  doseVolume: number;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function isConstraintPass(
  type: StructureType,
  metric: ConstraintMetric,
  value: number,
  limit: number,
): boolean {
  const measured = round(value);

  if (type === 'target' && metric === 'D95') {
    return measured >= limit;
  }

  return measured <= limit;
}

export function evaluateConstraint(structure: ConstraintSubject, rawValue: number): ConstraintCheck {
  const value = round(rawValue);

  return {
    structureId: structure.id,
    name: structure.name,
    metric: structure.constraint.metric,
    value,
    limit: structure.constraint.limit,
    unit: structure.constraint.unit,
    pass: isConstraintPass(structure.type, structure.constraint.metric, value, structure.constraint.limit),
    delta: round(value - structure.constraint.limit),
    doseVolume: structure.volume,
  };
}

export function gateStatus(checks: Pick<ConstraintCheck, 'pass'>[]): 'ready' | 'blocked' {
  return checks.every(check => check.pass) ? 'ready' : 'blocked';
}
