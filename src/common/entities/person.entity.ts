import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { vectorTransformer } from '../vector.transformer';

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @Column({ type: 'vector' as any, nullable: true, transformer: vectorTransformer })
  face_embedding: number[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  first_seen: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen: Date | null;

  @Column({ type: 'int', default: 0 })
  visit_count: number;
}
