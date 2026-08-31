'use strict';

/**
 * Research ablation protocol for LisanAI.
 *
 * Conditions isolate the incremental contribution of each harness module:
 *   baseline -> rubric -> evidence -> verification -> reliability -> full
 *
 * This module intentionally contains protocol/configuration only. Execution
 * remains delegated to the existing benchmark runner.
 */

const CONDITIONS = Object.freeze([
  {
    id: 'baseline',
    label: 'Baseline',
    description: 'Single-prompt whole-answer scoring without harness modules.',
    harness: {
      rubric: false,
      evidence: false,
      verification: false,
      reliability: false,
      calibration: false,
      safety: false,
    },
  },
  {
    id: 'rubric',
    label: '+ Rubric',
    description: 'Criterion-based rubric scoring only.',
    harness: {
      rubric: true,
      evidence: false,
      verification: false,
      reliability: false,
      calibration: false,
      safety: false,
    },
  },
  {
    id: 'evidence',
    label: '+ Evidence',
    description: 'Rubric scoring grounded in answer evidence.',
    harness: {
      rubric: true,
      evidence: true,
      verification: false,
      reliability: false,
      calibration: false,
      safety: false,
    },
  },
  {
    id: 'verification',
    label: '+ Verification',
    description: 'Rubric and evidence followed by verification.',
    harness: {
      rubric: true,
      evidence: true,
      verification: true,
      reliability: false,
      calibration: false,
      safety: false,
    },
  },
  {
    id: 'reliability',
    label: '+ Reliability',
    description: 'Adds reliability assessment to the verified evaluation.',
    harness: {
      rubric: true,
      evidence: true,
      verification: true,
      reliability: true,
      calibration: false,
      safety: false,
    },
  },
  {
    id: 'full',
    label: 'Full Harness',
    description: 'Complete research harness configuration.',
    harness: {
      rubric: true,
      evidence: true,
      verification: true,
      reliability: true,
      calibration: true,
      safety: true,
    },
  },
]);

function getCondition(id) {
  const condition = CONDITIONS.find((item) => item.id === id);
  if (!condition) throw new Error(`Unknown ablation condition: ${id}`);
  return condition;
}

function getConditions(ids) {
  if (!ids) return CONDITIONS.slice();
  const requested = Array.isArray(ids) ? ids : [ids];
  return requested.map(getCondition);
}

function buildHarnessConfig(id, overrides = {}) {
  return {
    ...getCondition(id).harness,
    ...overrides,
  };
}

function buildProtocol(ids) {
  return getConditions(ids).map((condition, index) => ({
    order: index + 1,
    conditionId: condition.id,
    label: condition.label,
    description: condition.description,
    harnessConfig: { ...condition.harness },
  }));
}

module.exports = {
  CONDITIONS,
  getCondition,
  getConditions,
  buildHarnessConfig,
  buildProtocol,
};
