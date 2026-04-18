import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CitationAiStyleDetectorService } from '../src/modules/citations/citation-ai-style-detector.service';
import { CitationStyleDetectorService } from '../src/modules/citations/citation-style-detector.service';

describe('CitationStyleDetectorService', () => {
  let service: CitationStyleDetectorService;
  let configValues: Record<string, string | number>;

  beforeEach(async () => {
    configValues = {
      citationAiEnabled: 'false',
      citationAiProvider: 'openai',
      citationAiBaseUrl: 'https://api.openai.test/v1',
      citationAiModel: 'gpt-4o-mini',
      citationAiApiKey: 'test-key',
      citationAiTimeoutMs: 15000,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitationStyleDetectorService,
        CitationAiStyleDetectorService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) =>
              key in configValues ? configValues[key] : defaultValue,
          },
        },
      ],
    }).compile();

    service = module.get(CitationStyleDetectorService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('detects APA style from author-date bibliography text', async () => {
    const result = await service.detectCitationStyle(
      [
        'Smith, J. (2020). Research methods in practice. Journal of Testing, 12(3), 45-67. https://doi.org/10.1234/example',
        'Doe, A. (2021). Second study. Another Journal, 8(2), 11-20. https://doi.org/10.1234/second',
      ].join('\n\n'),
    );

    expect(result.style).toBe('apa-7');
    expect(result.family).toBe('author-date');
    expect(result.confidenceScore).toBeGreaterThan(0.35);
    expect(result.aiAssisted).toBe(false);
  });

  it('detects numeric styles from numbered citations', async () => {
    const result = await service.detectCitationStyle(
      [
        '[1] J. Smith, A. Doe, "Efficient pipelines," IEEE Trans. Examples, vol. 12, no. 3, pp. 45-67, 2021.',
        '[2] A. Doe, J. Smith, "Another paper," J. Testing, vol. 8, no. 2, pp. 11-20, 2022.',
      ].join('\n'),
    );

    expect(result.family).toBe('numeric');
    expect(['vancouver', 'ieee', 'mdpi', 'ama', 'nlm']).toContain(result.style);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('detects MLA style from quoted titles and volume markers', async () => {
    const result = await service.detectCitationStyle(
      'Smith, John, and Jane Doe. "Human-centered design". Example Journal, vol. 12, no. 3, 2022, pp. 45-67.',
    );

    expect(result.style).toBe('mla');
    expect(result.family).toBe('mla');
    expect(result.confidenceScore).toBeGreaterThan(0.4);
  });

  it('detects Chicago notes bibliography style from notes markers', async () => {
    const result = await service.detectCitationStyle(
      '1. John Smith, "Research Notes," ibid., 2020.\n2. Jane Doe, op. cit., 2021.',
    );

    expect(result.style).toBe('chicago-notes-bibliography');
    expect(result.family).toBe('notes-bibliography');
  });

  it('uses optional AI refinement when rule-based confidence is low', async () => {
    configValues.citationAiEnabled = 'true';

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  style: 'apa-7',
                  family: 'author-date',
                  confidenceScore: 0.92,
                  reasons: ['author-date year markers and journal metadata'],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const result = await service.detectCitationStyle(
      'Smith, J. Research methods in practice. Journal of Testing.',
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.aiAssisted).toBe(true);
    expect(result.style).toBe('apa-7');
    expect(result.family).toBe('author-date');
    expect(result.aiSuggestion?.style).toBe('apa-7');
  });

  it('returns unknown when evidence is weak', async () => {
    const result = await service.detectCitationStyle('Random text without citation cues.');

    expect(result.style).toBe('unknown');
    expect(result.family).toBe('unknown');
    expect(result.confidenceScore).toBeLessThan(0.35);
    expect(result.aiAssisted).toBe(false);
  });
});
