package com.bethouse.engine.api;

import com.bethouse.engine.BetHouseEVEngine;
import com.bethouse.engine.BetHouseEVEngine.MarketInput;
import com.bethouse.engine.BetHouseEVEngine.MarketType;
import com.bethouse.engine.BetHouseEVEngine.Result;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class EVController {

    @PostMapping("/calculate")
    public Result calculate(@RequestBody EVRequest req) {

        MarketInput input = new MarketInput(
                req.sharpPrice,
                req.softPrice,
                MarketType.valueOf(req.marketType)
        );

        return BetHouseEVEngine.evaluate(input, req.bankroll);
    }
}