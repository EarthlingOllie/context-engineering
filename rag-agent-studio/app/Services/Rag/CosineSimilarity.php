<?php

namespace App\Services\Rag;

class CosineSimilarity
{
    /**
     * How alike two vectors point: 1 means the same direction, 0 unrelated, -1 opposite.
     *
     * @param  list<float>  $a
     * @param  list<float>  $b
     */
    public static function between(array $a, array $b): float
    {
        $dot = 0.0;
        $normA = 0.0;
        $normB = 0.0;

        foreach ($a as $i => $value) {
            $dot += $value * ($b[$i] ?? 0.0);
            $normA += $value * $value;
        }

        foreach ($b as $value) {
            $normB += $value * $value;
        }

        if ($normA == 0.0 || $normB == 0.0) {
            return 0.0;
        }

        return $dot / (sqrt($normA) * sqrt($normB));
    }
}
