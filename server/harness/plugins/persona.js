/**
 * Persona plugin — determines the evaluator role via a `before` hook that
 * injects the evaluator persona into the prompt builder.
 */
module.exports = {
  name: "persona",
  version: "1.0.0",
  async before(context) {
    const persona = context.input.persona || {
      role: "expert academic assessor",
      instruction: "Evaluate the student's answer according to the supplied rubric. Do not invent evidence.",
    };
    // Store the persona so the harness can build a persona-prefixed prompt.
    context.setPersona && context.setPersona(persona);
    context.persona = persona;
    context.trace && context.trace.event("PERSONA_SET", { role: persona.role });
    return context;
  },
};