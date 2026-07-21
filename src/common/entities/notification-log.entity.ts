import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Event } from './event.entity';

@Entity('notifications_log')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Event, { nullable: true })
  @JoinColumn({ name: 'event_id' })
  event: Event | null;

  @Column({ type: 'text', nullable: true })
  channel: string | null;

  @Column({ type: 'text', nullable: true })
  status: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  sent_at: Date;
}
