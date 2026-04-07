"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * assembleJobPacketTool — Wraps the existing assembleJobPacket logic.
 * Requires approval before execution.
 */
async function execute({ jobTicketId, requestedBy, approvalId, includeSections }) {
  if (!jobTicketId) {
    return { status: "error", error: "Missing required field: jobTicketId" };
  }
  if (!approvalId) {
    return { status: "error", error: "This tool requires approval. Missing approvalId." };
  }

  const db = getFirestore();

  try {
    // Verify approval exists and is granted
    const approvalDoc = await db.collection("agentApprovals").doc(approvalId).get();
    if (!approvalDoc.exists) {
      return { status: "error", error: `Approval ${approvalId} not found` };
    }
    const approval = approvalDoc.data();
    if (approval.status !== "approved") {
      return { status: "error", error: `Approval ${approvalId} is not approved (current: ${approval.status})` };
    }

    // Fetch the job ticket
    const ticketDoc = await db.collection("jobTickets").doc(jobTicketId).get();
    if (!ticketDoc.exists) {
      return { status: "not_found", error: `Job ticket ${jobTicketId} not found` };
    }

    const ticket = ticketDoc.data();
    const now = FieldValue.serverTimestamp();
    const sections = includeSections || ["ticket", "passport", "quote", "materials"];

    const packet = {
      jobTicketId,
      jobNumber: ticket.jobNumber || null,
      assembledBy: requestedBy || "agent",
      assembledAt: now,
      sections: {},
    };

    // Assemble each requested section
    if (sections.includes("ticket")) {
      packet.sections.ticket = ticket;
    }

    if (sections.includes("passport") && ticket.passportId) {
      const passportDoc = await db.collection("jobPassports").doc(ticket.passportId).get();
      packet.sections.passport = passportDoc.exists ? passportDoc.data() : null;
    }

    if (sections.includes("quote") && ticket.quoteId) {
      const quoteDoc = await db.collection("quotes").doc(ticket.quoteId).get();
      packet.sections.quote = quoteDoc.exists ? quoteDoc.data() : null;
    }

    if (sections.includes("materials") && ticket.materialIds && ticket.materialIds.length) {
      const materialDocs = await Promise.all(
        ticket.materialIds.map((id) => db.collection("materials").doc(id).get())
      );
      packet.sections.materials = materialDocs
        .filter((d) => d.exists)
        .map((d) => ({ id: d.id, ...d.data() }));
    }

    // Store the assembled packet
    const ref = await db.collection("jobPackets").add(packet);

    return { packetId: ref.id, jobTicketId, status: "assembled", sectionsIncluded: Object.keys(packet.sections) };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
