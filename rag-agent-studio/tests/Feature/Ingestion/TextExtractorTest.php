<?php

use App\Contracts\UrlFetcher;
use App\Models\Source;
use App\Services\Ingestion\ExtractionFailed;
use App\Services\Ingestion\TextExtractor;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
});

function fileSource(string $name, ?string $fixture = null, ?string $contents = null): Source
{
    $path = 'sources/'.$name;
    Storage::put($path, $contents ?? file_get_contents(base_path('tests/fixtures/'.$fixture)));

    return Source::factory()->file()->create(['path' => $path, 'title' => $name]);
}

it('reads a plain text file as it is', function () {
    $source = fileSource('hours.txt', 'sample.txt');

    expect(app(TextExtractor::class)->extract($source))
        ->toBe("Opening hours\n\nWe are open Monday to Friday, 9am to 5pm.\n\nReturns are accepted within 30 days.");
});

it('reads a Markdown file as it is', function () {
    $source = fileSource('notes.md', contents: "# Notes\n\nSome *markdown* text.\n");

    expect(app(TextExtractor::class)->extract($source))->toBe("# Notes\n\nSome *markdown* text.");
});

it('reads the words out of a PDF', function () {
    $source = fileSource('delivery.pdf', 'sample.pdf');

    expect(app(TextExtractor::class)->extract($source))
        ->toContain('Delivery takes two to three working days.')
        ->toContain('Orders over 50 pounds ship for free.');
});

it('reads the paragraphs out of a Word file', function () {
    $source = fileSource('refunds.docx', 'sample.docx');

    expect(app(TextExtractor::class)->extract($source))
        ->toBe("Our refund policy\nRefunds are paid within five days.\nGift cards & vouchers cannot be refunded.");
});

it('uses pasted text directly', function () {
    $source = Source::factory()->create(['raw_text' => "  Paste me.  \n"]);

    expect(app(TextExtractor::class)->extract($source))->toBe('Paste me.');
});

it('keeps only the readable words of a web page', function () {
    app()->instance(UrlFetcher::class, new class implements UrlFetcher
    {
        public function fetch(string $url): string
        {
            return <<<'HTML'
            <html><head><title>Shop</title><style>p { color: red }</style><script>alert('hi')</script></head>
            <body><h1>Welcome &amp; hello</h1><p>We sell <strong>hats</strong>.</p>
            <noscript>Enable scripts</noscript><ul><li>Caps</li><li>Beanies</li></ul></body></html>
            HTML;
        }
    });
    $source = Source::factory()->url()->create(['url' => 'https://example.com/shop']);

    expect(app(TextExtractor::class)->extract($source))
        ->toBe("Shop\nWelcome & hello\nWe sell hats.\nCaps\nBeanies");
});

it('passes on the fetcher’s plain-English failure for a web page', function () {
    app()->instance(UrlFetcher::class, new class implements UrlFetcher
    {
        public function fetch(string $url): string
        {
            throw new ExtractionFailed("We couldn't open that web page");
        }
    });
    $source = Source::factory()->url()->create();

    expect(fn () => app(TextExtractor::class)->extract($source))
        ->toThrow(ExtractionFailed::class, "We couldn't open that web page");
});

it('refuses a file type it cannot read', function () {
    $source = fileSource('setup.exe', contents: 'binary');

    expect(fn () => app(TextExtractor::class)->extract($source))
        ->toThrow(ExtractionFailed::class, 'We can only read PDF, Word, text and Markdown files');
});

it('explains when the file is missing from storage', function () {
    $source = Source::factory()->file()->create(['path' => 'sources/gone.txt']);

    expect(fn () => app(TextExtractor::class)->extract($source))
        ->toThrow(ExtractionFailed::class, "We couldn't find that file");
});

it('explains when a PDF cannot be read', function () {
    $source = fileSource('scan.pdf', contents: 'this is not really a pdf');

    expect(fn () => app(TextExtractor::class)->extract($source))
        ->toThrow(ExtractionFailed::class, "We couldn't read that PDF");
});

it('explains when a Word file is not really a Word file', function () {
    $source = fileSource('letter.docx', contents: 'this is not a zip');

    expect(fn () => app(TextExtractor::class)->extract($source))
        ->toThrow(ExtractionFailed::class, "We couldn't read that Word file");
});

it('explains when a Word file has no document inside', function () {
    $source = fileSource('empty.docx', 'broken.docx');

    expect(fn () => app(TextExtractor::class)->extract($source))
        ->toThrow(ExtractionFailed::class, "We couldn't read that Word file");
});

it('explains when there is no text to read', function () {
    $pasted = Source::factory()->create(['raw_text' => "   \n  "]);
    $blankFile = fileSource('blank.txt', contents: '');

    expect(fn () => app(TextExtractor::class)->extract($pasted))
        ->toThrow(ExtractionFailed::class, "There's no text to read in this source")
        ->and(fn () => app(TextExtractor::class)->extract($blankFile))
        ->toThrow(ExtractionFailed::class, "There's no text to read in this source");
});
