/**
 * Wraps sync localStorage storage in the same async interface as the API client.
 * Used when VITE_USE_API is not set so the app always uses Promise-based API.
 */
import * as local from './storage';
import type { ApiClient } from '../api/client';

export function createLocalStorageAdapter(): ApiClient {
  return {
    getGrammar: () => Promise.resolve(local.getGrammar()),
    getVocab: () => Promise.resolve(local.getVocab()),
    getSentences: () => Promise.resolve(local.getSentences()),

    createGrammar: (partial) => Promise.resolve(local.createGrammar(partial)),
    createVocab: (partial) => Promise.resolve(local.createVocab(partial)),
    createSentence: (partial) => Promise.resolve(local.createSentence(partial)),

    updateGrammar: (id, updates) => {
      local.updateGrammar(id, updates);
      return Promise.resolve();
    },
    updateVocab: (id, updates) => {
      local.updateVocab(id, updates);
      return Promise.resolve();
    },
    updateSentence: (id, updates) => {
      local.updateSentence(id, updates);
      return Promise.resolve();
    },

    deleteGrammar: (id) => {
      local.deleteGrammar(id);
      return Promise.resolve();
    },
    deleteVocab: (id) => {
      local.deleteVocab(id);
      return Promise.resolve();
    },
    deleteSentence: (id) => {
      local.deleteSentence(id);
      return Promise.resolve();
    },

    addGrammarBulk: (items) => Promise.resolve(local.addGrammarBulk(items)),
    addVocabBulk: (items) => Promise.resolve(local.addVocabBulk(items)),
    addSentencesBulk: (items) => Promise.resolve(local.addSentencesBulk(items)),
  };
}
