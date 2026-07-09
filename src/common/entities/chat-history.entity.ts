import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('chat_history')
export class ChatHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  query: string | null;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({ type: 'uuid', array: true, nullable: true })
  referenced_event_ids: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
