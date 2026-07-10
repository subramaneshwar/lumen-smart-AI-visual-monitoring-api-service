import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PersonsService } from './persons.service';
import { Person } from '../common/entities/person.entity';

describe('PersonsService', () => {
  let service: PersonsService;
  const mockManagerQuery = jest.fn();
  const mockPersonsRepo = {
    manager: { query: mockManagerQuery },
    findOneOrFail: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) =>
      Promise.resolve({ id: 'saved-id', ...(x as object) }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
        { provide: getRepositoryToken(Person), useValue: mockPersonsRepo },
      ],
    }).compile();
    service = module.get<PersonsService>(PersonsService);
  });

  it('updates and returns the existing person when the nearest match is within the threshold', async () => {
    mockManagerQuery.mockResolvedValue([{ id: 'person-1', distance: '0.2' }]);
    const existing = {
      id: 'person-1',
      visit_count: 3,
      last_seen: null,
    } as Person;
    mockPersonsRepo.findOneOrFail.mockResolvedValue(existing);

    const embedding = new Array(128).fill(0.1);
    const result = await service.matchOrCreate(embedding, 'org-1');

    expect(mockManagerQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY distance'),
      [`[${embedding.join(',')}]`, 'org-1'],
    );
    expect(mockPersonsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'person-1', visit_count: 4 }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'person-1' }));
  });

  it('creates a new person when the nearest match is beyond the threshold', async () => {
    mockManagerQuery.mockResolvedValue([{ id: 'person-1', distance: '5.0' }]);
    const embedding = new Array(128).fill(0.1);

    await service.matchOrCreate(embedding, 'org-1');

    expect(mockPersonsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        face_embedding: embedding,
        visit_count: 1,
        label: null,
      }),
    );
    expect(mockPersonsRepo.findOneOrFail).not.toHaveBeenCalled();
  });

  it('creates a new person when there are no existing persons at all', async () => {
    mockManagerQuery.mockResolvedValue([]);

    await service.matchOrCreate(new Array(128).fill(0.1), 'org-1');

    expect(mockPersonsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ visit_count: 1 }),
    );
  });
});
