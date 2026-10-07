<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Libraries\Claude\ClaudeException;
use Config\Archie;
use JsonException;

/**
 * Asks Claude (effort medium) for a vetting RECOMMENDATION on an adult application; it never
 * creates an account (see ApplicationService). Fails safe: any AI failure, refusal or
 * malformed answer yields NEEDS_REVIEW, and APPROVED is only accepted when confidence
 * ≥ 0.85 with no red flags (enforced here, not trusted from the model).
 */
class VettingService
{
    private const DECISIONS = ['APPROVED', 'NEEDS_REVIEW', 'REJECTED'];

    /**
     * Vets one application.
     *
     * @param array{email: string, role: string, dob: string, age: int, application_data: array<mixed>, link_code_verified: string} $application Applicant
     * @return array{decision: string, confidence: float, reasoning: string, red_flags: list<string>}
     */
    public function vet(array $application): array
    {
        try {
            $response = service('claude')->message(
                config(Archie::class)->vettingModel,
                Prompts::VETTING_SYSTEM,
                [['role' => 'user', 'content' => Prompts::vettingUser($application)]],
                1024,
                'medium',
            );

            if ($response->isRefusal()) {
                return self::fallback('AI vetting declined to assess — queued for manual admin review.', 'ai_refused');
            }

            return $this->parse($response->text);
        } catch (ClaudeException|JsonException $e) {
            log_message('error', '[VettingService::vet] ' . $e->getMessage());

            return self::fallback('AI vetting unavailable — queued for manual admin review.', 'ai_unavailable');
        }
    }

    /**
     * Parses and normalises Claude's JSON verdict.
     *
     * @param string $text Model output
     * @return array{decision: string, confidence: float, reasoning: string, red_flags: list<string>}
     * @throws JsonException When no valid JSON object is present
     */
    private function parse(string $text): array
    {
        if (preg_match('/\{.*\}/s', $text, $m) !== 1) {
            throw new JsonException('No JSON object in vetting response.');
        }

        $parsed = json_decode($m[0], true, 8, JSON_THROW_ON_ERROR);

        if (! is_array($parsed)) {
            throw new JsonException('Vetting response is not an object.');
        }

        $decision   = in_array($parsed['decision'] ?? null, self::DECISIONS, true) ? $parsed['decision'] : 'NEEDS_REVIEW';
        $confidence = is_numeric($parsed['confidence'] ?? null) ? max(0.0, min(1.0, (float) $parsed['confidence'])) : 0.5;
        $flags      = is_array($parsed['red_flags'] ?? null)
            ? array_values(array_map(static fn ($f): string => mb_substr((string) (is_scalar($f) ? $f : json_encode($f)), 0, 200), array_slice($parsed['red_flags'], 0, 10)))
            : [];

        if ($decision === 'APPROVED' && ($confidence < 0.85 || $flags !== [])) {
            $decision = 'NEEDS_REVIEW';
        }

        return [
            'decision'   => $decision,
            'confidence' => $confidence,
            'reasoning'  => mb_substr(trim((string) ($parsed['reasoning'] ?? '')), 0, 500),
            'red_flags'  => $flags,
        ];
    }

    /**
     * Fail-safe result.
     *
     * @param string $reason Reasoning text
     * @param string $flag   Red flag marker
     * @return array{decision: string, confidence: float, reasoning: string, red_flags: list<string>}
     */
    private static function fallback(string $reason, string $flag): array
    {
        return ['decision' => 'NEEDS_REVIEW', 'confidence' => 0.5, 'reasoning' => $reason, 'red_flags' => [$flag]];
    }
}
