<?php

namespace App\Drivers;

use App\Contracts\EmbeddingProvider;

class FakeEmbeddingProvider implements EmbeddingProvider
{
    public function embed(array $texts): array
    {
        return array_map(fn (string $text) => $this->vectorFor($text), $texts);
    }

    /** @return list<float> */
    private function vectorFor(string $text): array
    {
        $hash = md5($text);
        $vector = [];

        for ($i = 0; $i < 8; $i++) {
            $vector[] = hexdec(substr($hash, $i * 4, 4)) / 65535;
        }

        return $vector;
    }
}
