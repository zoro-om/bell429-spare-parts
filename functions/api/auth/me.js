import { me } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  return me(context.request, context.env);
}