# Use OpenJDK 17
FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install Maven and bash
RUN apk add --no-cache maven bash git

# Build project, skip tests
RUN mvn clean package -DskipTests

# Expose port 8080
EXPOSE 8080

# Run the Spring Boot app (dynamic JAR name)
CMD java -jar target/*.jar
