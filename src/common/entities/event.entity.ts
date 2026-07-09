import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { Camera } from './camera.entity';
import { Person } from './person.entity';
import { vectorTransformer } from '../vector.transformer';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Camera)
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person: Person | null;

  @Column({ type: 'text' })
  event_type: string;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ type: 'text', nullable: true })
  zone: string | null;

  @Column({ type: 'text', nullable: true })
  track_id: string | null;

  @Column({ type: 'int', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'text', nullable: true })
  clip_path: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'vector' as any, nullable: true, transformer: vectorTransformer })
  description_embedding: number[] | null;

  @Column({ type: 'text', nullable: true })
  action_taken: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
