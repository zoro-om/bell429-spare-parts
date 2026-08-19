import { logout } from "../../_lib/auth.js";
export async function onRequestPost(context) { return logout(context.request, context.env); }
