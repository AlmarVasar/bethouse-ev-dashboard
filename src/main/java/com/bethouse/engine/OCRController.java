package com.bethouse.engine;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OCRController {

    /**
     * Upload two images: Sharp odds and Soft odds
     */
    @PostMapping("/scan-odds")
    public Map<String, Object> scanOdds(
            @RequestParam("sharpFile") MultipartFile sharpFile,
            @RequestParam("softFile") MultipartFile softFile
    ) throws Exception {

        // 1️⃣ Save uploaded files temporarily
        File sharpTemp = File.createTempFile("sharp", ".png");
        sharpFile.transferTo(sharpTemp);

        File softTemp = File.createTempFile("soft", ".png");
        softFile.transferTo(softTemp);

        // 2️⃣ OCR setup
        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath("src/main/resources/");
        tesseract.setLanguage("eng");

        // 3️⃣ Extract text
        String sharpText = tesseract.doOCR(sharpTemp);
        String softText = tesseract.doOCR(softTemp);

        // 4️⃣ Convert OCR text to BetHouseEVEngine.MarketInput
        BetHouseEVEngine.MarketInput marketInput = parseTextToMarket(sharpText, softText);

        // 5️⃣ Calculate EV
        BetHouseEVEngine.Result result = BetHouseEVEngine.evaluate(marketInput, 100.0);

        // 6️⃣ Prepare response
        Map<String, Object> response = new HashMap<>();
        response.put("sharpText", sharpText);
        response.put("softText", softText);
        response.put("ev", result.ev());
        response.put("bet", result.bet());
        response.put("stake", result.stake());
        response.put("marketType", marketInput.marketType());
        response.put("sharpPrice", marketInput.sharpPrice());
        response.put("softPrice", marketInput.softPrice());

        return response;
    }

    /**
     * Convert OCR texts to MarketInput
     * Replace with your actual parsing logic
     */
    private BetHouseEVEngine.MarketInput parseTextToMarket(String sharpText, String softText) {
        // Example dummy values
        double sharpPrice = 2.5;          // extract from sharpText
        Double softPrice = 2.4;           // extract from softText
        BetHouseEVEngine.MarketType type = BetHouseEVEngine.MarketType.FULL_TIME;

        return new BetHouseEVEngine.MarketInput(sharpPrice, softPrice, type);
    }
}