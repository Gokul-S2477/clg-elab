import { apiGet } from "./api";

let cachedBootstrap = null;
let cachedAt = 0;
let inflightBootstrap = null;

const TTL_MS = 20 * 1000;

export const getPortalBootstrap = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && cachedBootstrap && now - cachedAt < TTL_MS) {
    return cachedBootstrap;
  }
  if (!force && inflightBootstrap) {
    return inflightBootstrap;
  }
  inflightBootstrap = apiGet("/portal/bootstrap")
    .then((payload) => {
      cachedBootstrap = payload;
      cachedAt = Date.now();
      return payload;
    })
    .finally(() => {
      inflightBootstrap = null;
    });
  return inflightBootstrap;
};

export const invalidatePortalBootstrap = () => {
  cachedBootstrap = null;
  cachedAt = 0;
  inflightBootstrap = null;
};
