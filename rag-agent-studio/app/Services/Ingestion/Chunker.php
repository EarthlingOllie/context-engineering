<?php

namespace App\Services\Ingestion;

/**
 * Splits source text into pieces small enough to store and search.
 *
 * Paragraphs are kept together while they fit; longer paragraphs are split
 * on sentence ends; a run of text with no sentence ends is cut by length.
 * Each piece starts with the tail of the previous one so meaning is not
 * lost at the cut.
 */
class Chunker
{
    public function __construct(
        public readonly int $size = 800,
        public readonly int $overlap = 150,
    ) {}

    /** @return list<string> */
    public function chunk(string $text): array
    {
        $pieces = $this->pieces($text);
        $chunks = [];
        $current = '';

        foreach ($pieces as $piece) {
            $candidate = $current === '' ? $piece : $current."\n".$piece;

            if (mb_strlen($candidate) <= $this->size) {
                $current = $candidate;

                continue;
            }

            $chunks[] = $current;
            $withTail = trim($this->tail($current).' '.$piece);
            $current = mb_strlen($withTail) <= $this->size ? $withTail : $piece;
        }

        if ($current !== '') {
            $chunks[] = $current;
        }

        return $chunks;
    }

    /**
     * Paragraphs that fit, otherwise their sentences, otherwise fixed-length cuts.
     *
     * @return list<string>
     */
    private function pieces(string $text): array
    {
        $pieces = [];

        foreach (preg_split('/\n\s*\n/', str_replace("\r\n", "\n", $text)) as $paragraph) {
            $paragraph = trim(preg_replace('/\s+/', ' ', $paragraph));

            if ($paragraph === '') {
                continue;
            }

            if (mb_strlen($paragraph) <= $this->size) {
                $pieces[] = $paragraph;

                continue;
            }

            foreach (preg_split('/(?<=[.!?])\s+/', $paragraph) as $sentence) {
                array_push($pieces, ...$this->words($sentence));
            }
        }

        return $pieces;
    }

    /**
     * Pack a sentence's words into runs no longer than the size; a single
     * word longer than the size is cut by length.
     *
     * @return list<string>
     */
    private function words(string $sentence): array
    {
        $runs = [];
        $run = '';

        foreach (explode(' ', $sentence) as $word) {
            foreach (mb_str_split($word, $this->size) as $part) {
                $candidate = $run === '' ? $part : $run.' '.$part;

                if (mb_strlen($candidate) <= $this->size) {
                    $run = $candidate;

                    continue;
                }

                $runs[] = $run;
                $run = $part;
            }
        }

        if ($run !== '') {
            $runs[] = $run;
        }

        return $runs;
    }

    /** The last words of a chunk, up to the overlap length, used to start the next chunk. */
    private function tail(string $chunk): string
    {
        if ($this->overlap === 0) {
            return '';
        }

        $tail = mb_substr($chunk, -$this->overlap);

        // Prefer starting the overlap at a sentence, then at a word.
        $sentences = preg_split('/(?<=[.!?])\s+/', $tail, 2);
        if (count($sentences) === 2) {
            return $sentences[1];
        }

        $space = mb_strpos($tail, ' ');

        return $space === false ? $tail : trim(mb_substr($tail, $space));
    }
}
