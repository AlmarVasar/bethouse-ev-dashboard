# Use OpenJDK 17
FROM eclipse-temurin:17-jdk-alpine

# Set working directory
WORKDIR /app

# Copy all project files
COPY . .

# Install Maven
RUN apk add --no-cache maven bash git

# Build the project, skip tests
RUN mvn clean package -DskipTests

# Expose the port Spring Boot will use
EXPOSE 8080

# Run the Spring Boot app
CMD ["java", "-jar", "target/bethouse-engine-0.0.1-SNAPSHOT.jar"]
