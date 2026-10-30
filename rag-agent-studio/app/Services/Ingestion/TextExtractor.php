<?php

namespace App\Services\Ingestion;

use App\Contracts\UrlFetcher;
use App\Enums\SourceType;
use App\Models\Source;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser as PdfParser;
use Throwable;
use ZipArchive;

/** Turns a source (file, pasted text or web page) into plain text. */
class TextExtractor
{
    public function __construct(private readonly UrlFetcher $webPages) {}

    /** @throws ExtractionFailed with a plain-English reason */
    public function extract(Source $source): string
    {
        $text = match ($source->type) {
            SourceType::Text => (string) $source->raw_text,
            SourceType::Url => $this->fromWebPage((string) $source->url),
            SourceType::File => $this->fromFile((string) $source->path),
        };

        $text = trim($text);

        if ($text === '') {
            throw new ExtractionFailed("There's no text to read in this source");
        }

        return $text;
    }

    private function fromFile(string $path): string
    {
        if (! Storage::exists($path)) {
            throw new ExtractionFailed("We couldn't find that file");
        }

        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'txt', 'md' => (string) Storage::get($path),
            'pdf' => $this->fromPdf((string) Storage::get($path)),
            'docx' => $this->fromWord(Storage::path($path)),
            default => throw new ExtractionFailed('We can only read PDF, Word, text and Markdown files'),
        };
    }

    private function fromPdf(string $contents): string
    {
        try {
            return (new PdfParser)->parseContent($contents)->getText();
        } catch (Throwable) {
            throw new ExtractionFailed("We couldn't read that PDF");
        }
    }

    private function fromWord(string $absolutePath): string
    {
        $zip = new ZipArchive;
        $xml = $zip->open($absolutePath) === true ? $zip->getFromName('word/document.xml') : false;

        if ($xml === false) {
            throw new ExtractionFailed("We couldn't read that Word file");
        }

        $zip->close();

        $xml = preg_replace(['#<w:tab/>#', '#<w:br/>#', '#</w:p>#'], [' ', "\n", "\n"], $xml);

        return $this->tidy(strip_tags($xml));
    }

    private function fromWebPage(string $url): string
    {
        $html = $this->webPages->fetch($url);

        $html = preg_replace('#<(script|style|noscript)\b[^>]*>.*?</\1>#is', '', $html);
        $html = preg_replace('#</(p|div|h[1-6]|li|tr|br|title|section|article|header|footer|blockquote|pre)>|<br\s*/?>#i', "\n", $html);

        return $this->tidy(strip_tags($html));
    }

    /** Decode entities and collapse the whitespace left behind by markup. */
    private function tidy(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $lines = array_map(fn (string $line) => trim(preg_replace('/[ \t\x{00A0}]+/u', ' ', $line)), explode("\n", $text));

        return implode("\n", array_filter($lines, fn (string $line) => $line !== ''));
    }
}
