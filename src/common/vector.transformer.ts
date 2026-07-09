import { ValueTransformer } from 'typeorm';

export const vectorTransformer: ValueTransformer = {
  to: (value: number[] | null) => (value ? `[${value.join(',')}]` : null),
  from: (value: string | null) =>
    value ? value.slice(1, -1).split(',').map(Number) : null,
};
