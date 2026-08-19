import { login } from "../../_lib/auth.js";
export async function onRequestPost(context) { return login(context.request, context.env); }
