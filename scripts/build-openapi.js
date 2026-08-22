// Regenerates api/openapi.json described by external integrators.
// Includes: Public API (/api/v1/*) + AI assessment action (/api/assessment)
// + docs endpoints. Internal/manager endpoints (auth, database, apikeys,
// research, observability) are intentionally excluded from the public spec.
const fs = require("node:fs");
const path = require("node:path");

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Lisan.ai Public API",
    version: "1.0.0",
    description:
      "API publik untuk integrasi sistem eksternal dengan platform penilaian lisan berbasis AI: generate soal, evaluasi jawaban, rekomendasi rubrik, serta daftar assessment dan submission.\n\n## Autentikasi\n\nSeluruh endpoint wajib mengirim **API Key** pada header `Authorization`:\n\n```\nAuthorization: Bearer lsk_xxx\n```\n\nAPI key (prefix `lsk_`) dapat dibuat oleh admin di halaman **Akun → API Keys** di dalam aplikasi. API key tidak memerlukan CSRF token."
  },
  servers: [
    { url: "https://lisan-ai-assessment.vercel.app/api/v1", description: "Production (Vercel)" },
    { url: "http://127.0.0.1:4173/api/v1", description: "Local development" }
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "lsk_",
        description: "API key dengan prefix `lsk_`. Contoh: `Authorization: Bearer lsk_xxx`"
      }
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string", example: "Unauthorized" } }
      },
      Assessment: {
        type: "object",
        properties: {
          id: { type: "string" },
          topic: { type: "string" },
          difficulty: { type: "string" },
          status: { type: "string", enum: ["published", "closed"] },
          created_at: { type: "string", format: "date-time" }
        }
      },
      Submission: {
        type: "object",
        properties: {
          id: { type: "string" },
          assessment_id: { type: "string" },
          student_name: { type: "string" },
          final_score: { type: "integer" },
          submitted_at: { type: "string", format: "date-time" }
        }
      },
      GenerateRequest: {
        type: "object",
        required: ["topic"],
        properties: {
          topic: { type: "string", description: "Topik atau materi assessment" },
          outcomes: { type: "string", description: "Kompetensi / capaian pembelajaran" },
          rubric: { type: "string", description: "Rubrik penilaian" },
          difficulty: { type: "string", enum: ["Dasar", "Menengah", "Lanjutan"], default: "Menengah" },
          count: { type: "integer", minimum: 1, maximum: 20, default: 5, description: "Jumlah soal" },
          examples: { type: "string", description: "Contoh soal opsional" }
        }
      },
      Question: {
        type: "object",
        properties: {
          id: { type: "string" },
          prompt: { type: "string" },
          focus: { type: "string" },
          outcome: { type: "string" },
          rubric: { type: "string" },
          ideal: { type: "string" }
        }
      },
      EvaluateRequest: {
        type: "object",
        required: ["assessment", "answers"],
        properties: {
          assessment: {
            type: "object",
            description: "Objek assessment (bisa dari hasil generate atau buatan sendiri)",
            properties: {
              id: { type: "string" },
              topic: { type: "string" },
              rubric: { type: "string", description: "Rubrik penilaian" },
              outcomes: { type: "string" },
              oralExamEnabled: { type: "boolean", default: true, description: "true = penilaian ujian lisan (tidak menghukum format tulisan)" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    prompt: { type: "string" },
                    outcome: { type: "string" },
                    rubric: { type: "string" }
                  }
                }
              }
            }
          },
          answers: {
            type: "array",
            items: { type: "string" },
            description: "Jawaban siswa, satu per soal (urutan sama dengan questions)"
          },
          studentName: { type: "string" }
        }
      },
      Evaluation: {
        type: "object",
        properties: {
          finalScore: { type: "integer", minimum: 0, maximum: 100 },
          feedback: { type: "string" },
          questionScores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
                score: { type: "integer" },
                matched: { type: "array", items: { type: "string" } },
                strengths: { type: "array", items: { type: "string" } },
                gaps: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      },
      RecommendRequest: {
        type: "object",
        required: ["topic"],
        properties: {
          topic: { type: "string" },
          difficulty: { type: "string", enum: ["Dasar", "Menengah", "Lanjutan"], default: "Menengah" }
        }
      },
      Recommendation: {
        type: "object",
        properties: {
          outcomes: { type: "string" },
          rubric: { type: "string" }
        }
      }
    }
  },
  paths: {
    "/assessments": {
      get: {
        summary: "Daftar assessment",
        description: "Mengembalikan daftar assessment milik tenant.",
        tags: ["Assessments"],
        responses: {
          200: {
            description: "Daftar assessment",
            content: { "application/json": { schema: { type: "object", properties: { assessments: { type: "array", items: ref("Assessment") } } } } }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/submissions": {
      get: {
        summary: "Daftar submission",
        description: "Mengembalikan daftar submission milik tenant.",
        tags: ["Submissions"],
        responses: {
          200: {
            description: "Daftar submission",
            content: { "application/json": { schema: { type: "object", properties: { submissions: { type: "array", items: ref("Submission") } } } } }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/assessments/generate": {
      post: {
        summary: "Generate soal",
        description: "Membuat soal assessment lisan berdasarkan konfigurasi menggunakan AI.",
        tags: ["Assessments"],
        requestBody: { required: true, content: { "application/json": { schema: ref("GenerateRequest") } } },
        responses: {
          200: {
            description: "Soal berhasil dibuat",
            content: { "application/json": { schema: { type: "object", properties: { questions: { type: "array", items: ref("Question") } } } } }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" }
        }
      }
    },
    "/assessments/evaluate": {
      post: {
        summary: "Evaluasi jawaban",
        description: "Menilai jawaban siswa berdasarkan rubrik menggunakan AI.",
        tags: ["Assessments"],
        requestBody: { required: true, content: { "application/json": { schema: ref("EvaluateRequest") } } },
        responses: {
          200: {
            description: "Hasil evaluasi",
            content: { "application/json": { schema: { type: "object", properties: { evaluation: ref("Evaluation") } } } }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" }
        }
      }
    },
    "/assessments/recommend": {
      post: {
        summary: "Rekomendasi konfigurasi",
        description: "Membuat rekomendasi kompetensi (learning outcome) dan rubrik untuk topik tertentu.",
        tags: ["Assessments"],
        requestBody: { required: true, content: { "application/json": { schema: ref("RecommendRequest") } } },
        responses: {
          200: {
            description: "Rekomendasi",
            content: { "application/json": { schema: { type: "object", properties: { recommendation: ref("Recommendation") } } } }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" }
        }
      }
    }
  },
  responses: {
    Unauthorized: {
      description: "API key tidak valid atau tidak disertakan",
      content: { "application/json": { schema: ref("Error") } }
    },
    ServerError: {
      description: "Terjadi kesalahan server",
      content: { "application/json": { schema: ref("Error") } }
    }
  }
};

const target = path.join(__dirname, "..", "api", "openapi.json");
fs.writeFileSync(target, JSON.stringify(spec, null, 2) + "\n");
console.log("Wrote", target);
console.log("paths:", Object.keys(spec.paths).length, "| schemas:", Object.keys(spec.components.schemas).length);