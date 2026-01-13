const express = require("express");
const router = express.Router();
const MembershipPlanController = require("../controller/membershipPlanController");

router.post("/membership-plans", MembershipPlanController.createMembershipPlan);
router.get(
  "/view-membership-plans",
  MembershipPlanController.viewMembershipPlan
);
router.patch(
  "/membership-plans/:id",
  MembershipPlanController.editMembershipPlan
);
router.get(
  "/membership-plans/:id",
  MembershipPlanController.getMembershipPlanById
);
router.patch(
  "/membership-plans/:id/status",
  MembershipPlanController.updateMembershipActiveStatus
);

//membership plan route to membership registration form
router.get(
  "/view-membershipplans/regform",
  MembershipPlanController.showActiveMembershipPlanToMembers
);

module.exports = router;
