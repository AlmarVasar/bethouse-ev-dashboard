package com.bethouse.engine;


public final class BetHouseEVEngine {

    /* ============================
       ======== DATA MODELS ========
       ============================ */

    /**
     * @param softPrice nullable
     */
    public record MarketInput(double sharpPrice, Double softPrice, MarketType marketType) {
        public MarketInput {
            if (sharpPrice <= 1.0)
                throw new HardFail("Invalid SHARP price");

        }
    }

    public enum MarketType {
        FULL_TIME,
        FIRST_HALF
    }

    public record FairRange(double low, double high) {
        public FairRange {
            if (low <= 1.0 || high <= 1.0 || low >= high)
                throw new HardFail("Invalid FAIR range");

        }
    }

    public record Result(FairRange fair, Double ev, boolean bet, double stake, String auditStatus) {
    }

    /* ============================
       ======== ENGINE CORE ========
       ============================ */

    public static Result evaluate(
            MarketInput input,
            double bankroll
    ) {

        auditSharpInvariantFilters();
        FairRange fair = calculateFairFromSharp(input.sharpPrice);

        auditFairRange(fair);

        // SAG-1 — Soft Availability Gate
        if (input.softPrice == null) {
            return new Result(
                    fair,
                    null,
                    false,
                    0.0,
                    "PASS (SAG-STOP)"
            );
        }

        double ev = calculateEVWorstCase(fair, input.softPrice);

        auditEVSign(fair, input.softPrice, ev);

        boolean bet = ev > 0;
        double stake = bet ? calculateStake(ev, bankroll, input.marketType) : 0.0;

        return new Result(
                fair,
                ev,
                bet,
                stake,
                "PASS"
        );
    }

    /* ============================
       ===== FAIR CALCULATION =====
       ============================ */

    private static FairRange calculateFairFromSharp(double sharpPrice) {

        // Vig removal (simple deterministic model)
        double impliedProb = 1.0 / sharpPrice;
        double fairProb = impliedProb * 0.985; // invariant vig removal

        double fairMid = 1.0 / fairProb;

        // FAIR RANGE (not a point)
        return new FairRange(
                fairMid * 0.985,
                fairMid * 1.015
        );
    }

    /* ============================
       ======== EV LOGIC ===========
       ============================ */

    private static double calculateEVWorstCase(FairRange fair, double softPrice) {

        double worstFair = softPrice > fair.high ? fair.high : fair.low;

        return (softPrice / worstFair) - 1.0;
    }

    private static void auditEVSign(FairRange fair, double softPrice, double ev) {

        if (softPrice > fair.high && ev <= 0)
            throw new HardFail("EV SIGN VIOLATION (+ expected)");

        if (softPrice < fair.low && ev >= 0)
            throw new HardFail("EV SIGN VIOLATION (- expected)");
    }

    /* ============================
       ======== STAKING ============
       ============================ */

    private static double calculateStake(double ev, double bankroll, MarketType type) {

        double cap = type == MarketType.FULL_TIME ? 0.022 : 0.013;

        double rawStake = bankroll * ev;
        double cappedStake = bankroll * cap;

        return Math.min(rawStake, cappedStake);
    }

    /* ============================
       ======== AUDITS =============
       ============================ */

    private static void auditSharpInvariantFilters() {
        // TSF-1, HAI-2, CSF-3, MIM-4
        // DME-5, CPI-7, LSV-3
        // Locked active — placeholder hooks
    }

    private static void auditFairRange(FairRange fair) {
        if (fair.low <= 1.0 || fair.high <= fair.low)
            throw new HardFail("FAIR RANGE AUDIT FAIL");
    }

    /* ============================
       ======== HARD FAIL ==========
       ============================ */

    public static final class HardFail extends RuntimeException {
        public HardFail(String msg) {
            super("HARD FAIL: " + msg);
        }
    }
}