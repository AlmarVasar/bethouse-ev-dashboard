package com.bethouse.engine;

public class MarketInput {

    private double sharpPrice;
    private double softPrice;
    private double bankroll;
    private String marketType;

    public MarketInput(double sharpPrice, double softPrice, double bankroll, String marketType) {
        this.sharpPrice = sharpPrice;
        this.softPrice = softPrice;
        this.bankroll = bankroll;
        this.marketType = marketType;
    }

    public double getSharpPrice() { return sharpPrice; }
    public double getSoftPrice() { return softPrice; }
    public double getBankroll() { return bankroll; }
    public String getMarketType() { return marketType; }
}
