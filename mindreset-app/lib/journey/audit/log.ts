// Append one row to the Journey audit log per turn.
// The state report blob is encrypted; operational metadata is plain for
// queryability. Practice runs (if any) are written as child rows.

import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encrypt';
import type { StateReport } from '../stateReport/schema';

export type AuditWrite = {
  userId: string;
  stageAtTurn: number;
  depthAtTurn: string;
  userMessage: string;
  report: StateReport;
};

export async function writeAuditTurn(w: AuditWrite): Promise<string> {
  const userMessageHash = createHash('sha256').update(w.userMessage).digest('hex');

  const turn = await prisma.journeyTurn.create({
    data: {
      userId: w.userId,
      stageAtTurn: w.stageAtTurn,
      depthAtTurn: w.depthAtTurn,
      intensityReported: w.report.intensity,
      safetyFlag: w.report.safetyFlag,
      redFlagType: w.report.redFlagType ?? null,
      recommendedAction: w.report.recommendedAction,
      stateReportEncrypted: encrypt(JSON.stringify(w.report)),
      userMessageHash,
    },
  });

  // Practice run, if any — write as a child row.
  if (w.report.practiceRun && w.report.practiceRun.kind !== 'none' && w.report.practiceRun.name) {
    await prisma.journeyPracticeRun.create({
      data: {
        userId: w.userId,
        turnId: turn.id,
        stageAtRun: w.stageAtTurn,
        kind: w.report.practiceRun.kind,
        name: w.report.practiceRun.name,
        family: w.report.practiceRun.family ?? null,
        triggeredBy: w.report.practiceRun.triggeredBy ?? null,
        userImagesEncrypted: w.report.practiceRun.userImages
          ? encrypt(w.report.practiceRun.userImages)
          : null,
        depth: w.report.practiceRun.depth ?? null,
        status: w.report.practiceRun.status,
        modalitySwitchedFrom: w.report.practiceRun.modalitySwitched?.from ?? null,
        modalitySwitchedTo: w.report.practiceRun.modalitySwitched?.to ?? null,
      },
    });
  }

  return turn.id;
}
