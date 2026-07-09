import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from './organization.entity';

@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  zone: string | null;

  @Column({ type: 'text', nullable: true })
  stream_url: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
