import { NextResponse } from "next/server";
import { MESA_AI_PROBLEMS, MesaAiError, problemOfError } from "./ai";
import { MesaError } from "./data";

/** A failed La Mesa request, in words for the team: a step that can't be
 * done (400), or Claude's problem (key, credit, busy…: 502). */
export function mesaErrorResponse(error: unknown): NextResponse {
  if (error instanceof MesaError) return NextResponse.json({ error: "mesa", message: error.message }, { status: 400 });
  const problem = problemOfError(error);
  if (problem === "error") console.error("la mesa:", error);
  const message = error instanceof MesaAiError ? error.message : MESA_AI_PROBLEMS[problem];
  return NextResponse.json({ error: problem, message }, { status: 502 });
}
