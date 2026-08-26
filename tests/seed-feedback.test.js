const test = require("node:test");
const assert = require("node:assert/strict");

const {
  deriveQuestionStrengths,
  deriveQuestionGaps,
  feedbackLanguage,
} = require("../scripts/seed-accounts");

const cases = [
  {
    answer: "Me name is Budi.",
    score: 60,
    prompt: "What is your name?",
    lang: "en",
    hasStrengths: true,
    expectsGap: /Me/,
  },
  {
    answer: "I living in Jakarta.",
    score: 70,
    prompt: "Where do you live?",
    lang: "en",
    hasStrengths: true,
    expectsGap: /verb/i,
  },
  {
    answer: "My hobbies are reading and swimming.",
    score: 85,
    prompt: "What are your hobbies?",
    lang: "en",
    hasStrengths: true,
    expectsGap: null,
  },
  {
    answer: "Because it make me happy.",
    score: 70,
    prompt: "Why do you like it?",
    lang: "en",
    hasStrengths: true,
    expectsGap: /subject-verb/,
  },
  {
    answer: "I went to Bali with my family.",
    score: 95,
    prompt: "Where did you go for your last holiday?",
    lang: "en",
    hasStrengths: true,
    expectsGap: null,
  },
  {
    answer: "Yes, because the beach is beautiful.",
    score: 80,
    prompt: "Did you enjoy it? Why?",
    lang: "en",
    hasStrengths: true,
    expectsGap: /past tense/,
  },
  {
    answer: "Selamat pagi semuanya yang terhormat.",
    score: 80,
    prompt: "Sampaikan salam pembuka dan sapaan penghormatan kepada hadirin.",
    lang: "id",
    hasStrengths: true,
    expectsGap: /detail/,
  },
  {
    answer: "Mari kita bersyukur kepada Tuhan.",
    score: 85,
    prompt: "Sampaikan kalimat ucapan syukur sebagai pengantar pidato.",
    lang: "id",
    hasStrengths: true,
    expectsGap: null,
  },
  {
    answer: "Menurut saya sebaiknya dilarang karena banyak konten tidak mendidik.",
    score: 95,
    prompt: "Apa pendapat utama Anda mengenai penggunaan sosial media pada anak di bawah umur?",
    lang: "id",
    hasStrengths: true,
    expectsGap: null,
  },
];

test("feedbackLanguage detects Indonesian vs English answers", () => {
  assert.equal(feedbackLanguage("I live in Jakarta."), "en");
  assert.equal(feedbackLanguage("Menurut saya sebaiknya dilarang."), "id");
});

for (const c of cases) {
  test(`strengths derived deterministically for: ${c.answer.slice(0, 40)}...`, () => {
    const strengths = deriveQuestionStrengths(c.answer, c.score);
    assert.equal(feedbackLanguage(c.answer), c.lang);
    assert.ok(Array.isArray(strengths) && strengths.length > 0);
    assert.ok(strengths.length <= 3);
    if (c.hasStrengths) {
      assert.ok(strengths.every((s) => typeof s === "string" && s.trim().length));
    }
  });

  test(`gaps derived for: ${c.answer.slice(0, 40)}...`, () => {
    const gaps = deriveQuestionGaps(c.answer, c.score, { prompt: c.prompt });
    assert.ok(Array.isArray(gaps) && gaps.length <= 3);
    if (c.expectsGap) {
      assert.ok(gaps.some((g) => c.expectsGap.test(g)), `expected a gap matching ${c.expectsGap}, got ${JSON.stringify(gaps)}`);
    } else {
      assert.equal(gaps.length, 0, `expected no gaps, got ${JSON.stringify(gaps)}`);
    }
  });
}

test("equivalent answers produce identical feedback (determinism)", () => {
  const a = deriveQuestionGaps("I living in Jakarta.", 70, { prompt: "Where do you live?" });
  const b = deriveQuestionGaps("I living in Jakarta.", 70, { prompt: "Where do you live?" });
  assert.deepEqual(a, b);
});