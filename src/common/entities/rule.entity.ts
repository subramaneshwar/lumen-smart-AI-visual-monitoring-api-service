import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from './organization.entity';

@Entity('rules')
export class Rule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'text', nullable: true })
  template: string | null;

  @Column({ type: 'jsonb' })
  config: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
