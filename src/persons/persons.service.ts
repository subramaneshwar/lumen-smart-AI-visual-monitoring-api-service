import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../common/entities/person.entity';
import { Organization } from '../common/entities/organization.entity';

const MATCH_THRESHOLD = 0.6;

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person) private readonly persons: Repository<Person>,
  ) {}

  async matchOrCreate(
    embedding: number[],
    organizationId: string,
  ): Promise<Person> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows: { id: string; distance: string }[] =
      await this.persons.manager.query(
        `SELECT id, face_embedding <-> $1 AS distance FROM persons WHERE org_id = $2 ORDER BY distance ASC LIMIT 1`,
        [vectorLiteral, organizationId],
      );

    if (rows.length > 0 && Number(rows[0].distance) <= MATCH_THRESHOLD) {
      const match = await this.persons.findOneOrFail({
        where: { id: rows[0].id },
      });
      match.last_seen = new Date();
      match.visit_count += 1;
      return this.persons.save(match);
    }

    const created = this.persons.create({
      organization: { id: organizationId } as Organization,
      label: null,
      face_embedding: embedding,
      first_seen: new Date(),
      last_seen: new Date(),
      visit_count: 1,
    });
    return this.persons.save(created);
  }
}
