package com.bethouse.engine.api;

import com.bethouse.engine.BetHouseEVEngine.HardFail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(HardFail.class)
    public ResponseEntity<?> handleHardFail(HardFail ex) {
        return ResponseEntity.badRequest().body(
                Map.of(
                        "status", "FAIL",
                        "message", ex.getMessage()
                )
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGeneric(Exception ex) {
        return ResponseEntity.internalServerError().body(
                Map.of(
                        "status", "ERROR",
                        "message", "Internal engine error"
                )
        );
    }
}
