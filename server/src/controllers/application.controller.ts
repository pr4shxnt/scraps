import type { Response } from "express";
import CompanyApplication from "../models/company-application.model.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import CompanyProfile from "../models/company-profile.model.js";
import CompanyJob from "../models/company-job.model.js";

type ApplicationTab = "matches" | "let_it_go";
const ALLOWED_TABS: ApplicationTab[] = ["matches", "let_it_go"];

export async function listMyApplications(
  request: AuthenticatedRequest,
  response: Response,
) {
  const userId = request.user?.userId;

  if (!userId) {
    response.status(401).json({ message: "Unauthorized" });
    return;
  }

  const tabParam = request.query.tab;
  const tab = typeof tabParam === "string" ? tabParam : undefined;

  if (tab && !ALLOWED_TABS.includes(tab as ApplicationTab)) {
    response
      .status(400)
      .json({ message: "tab must be one of: matches, let_it_go" });
    return;
  }

  try {
    const query: any = {};
    if (request.user?.role === "User") {
      query.candidateId = userId;
    } else {
      query.ownerId = userId;
    }

    if (tab === "matches") {
      query.status = { $in: ["New", "Shortlisted", "Interview"] };
    } else if (tab === "let_it_go") {
      query.status = "Rejected";
    }

    const applications = await CompanyApplication.find(query).sort({ appliedAt: -1 }).lean();

    const items = await Promise.all(
      applications.map(async (app) => {
        const [companyProfile, companyJob] = await Promise.all([
          CompanyProfile.findOne({ ownerId: app.ownerId }).lean(),
          CompanyJob.findOne({ ownerId: app.ownerId, id: app.jobId }).lean(),
        ]);

        return {
          ...app,
          companyDetails: companyProfile || null,
          jobDetails: companyJob || null,
        };
      })
    );

    response.status(200).json({
      items,
      total: items.length,
      tab: tab ?? "all",
    });
  } catch (error) {
    response.status(500).json({ message: "Unable to list applications" });
  }
}
