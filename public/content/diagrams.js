(function () {
  'use strict';

  var CHAPTER_DIAGRAMS = window.CHAPTER_DIAGRAMS = window.CHAPTER_DIAGRAMS || {};

  // ===================== System Design =====================
  CHAPTER_DIAGRAMS["sd-foundations/exercises-foundations"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    A["Read the exercise prompt"] --> B{"What must you decide?"}

    B -->|Capacity| C{"Stored data or live connections?"}
    C -->|Photos| D["2B photos per week × 3 MB × 52"]
    D --> E["About 312 PB of new storage per year"]
    C -->|WebSockets| F["10M users ÷ 50K per server; add peak and redundancy"]
    F --> G["About 400–500 servers behind a Layer 4 load balancer"]

    B -->|Requirements| H["Separate user functions from quality targets"]
    H --> I["Lock spot assignment; keep a local offline fallback"]

    B -->|Traffic spike| J["Offload browsing with CDN, cache, and read replicas"]
    J --> K["Protect checkout with a queue, rate limits, and graceful degradation"]

    B -->|Protocol| L{"Can an older update be discarded?"}
    L -->|Yes| M["Player movement: UDP"]
    L -->|No; bidirectional| N["Chat: WebSocket over TCP"]
    L -->|Request and response| O["Leaderboard and matchmaking: HTTP"]

    B -->|API contract| P["Model borrowing as its own resource"]
    P --> Q["Use an idempotency key and actionable 409 or 403 errors"]

    B -->|Data format| R{"Where does the data travel?"}
    R -->|Mobile or third party| S["JSON"]
    R -->|Low-latency service call| T["Protobuf with gRPC"]
    R -->|Shared event stream| U["Avro with a schema registry"]
    R -->|Analytics scan| V["Parquet"]
\`\`\``;

  CHAPTER_DIAGRAMS["sd-reliability/exercises-reliability"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    A["Read the reliability scenario"] --> B{"Which risk is primary?"}

    B -->|Inconsistent data| C{"Which banking operation?"}
    C -->|Balance or transfer| D["Use linearizable writes through the home-region leader"]
    D --> E["During a partition: reject remote writes or queue cross-region transfers"]
    C -->|Transaction history| F["Read your writes, then use a local replica"]
    F --> G["During a partition: keep slightly stale reads available"]
    C -->|Monthly statement| H["Use eventual, offline batch processing"]

    B -->|Request overload| I["Check a token bucket at the API gateway"]
    I --> J["Run one atomic Redis Lua update across all 20 servers"]
    J --> K{"Token available?"}
    K -->|Yes| L["Forward the request"]
    K -->|No| M["Return 429 with limit, reset, and retry headers"]
    J -->|Redis unavailable| N["Fail open; log and alert"]

    B -->|Production incident| O["Check latency, traffic, errors, and saturation"]
    O --> P["Find p99 at 30 s and the DB pool at 98 of 100"]
    P --> Q["Trace the slow transaction query"]
    Q --> R["Confirm the missing user-and-date index"]
    R --> S["Build the index concurrently and watch success recover"]
    S --> T["Record prevention work in the post-mortem"]

    B -->|New notification service| U["Trace Kafka consume → render → provider → status write"]
    U --> V["Join metrics and structured logs with the trace ID"]
    V --> W{"Reliability threshold breached?"}
    W -->|Immediate harm| X["Page on backlog, provider failures, or zero sends"]
    W -->|Degradation| Y["Investigate provider latency, bounces, or dead-letter work"]
\`\`\``;

  // ===================== Microservices =====================
  CHAPTER_DIAGRAMS["ms-architecture/containerisation"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    subgraph BUILD["Build once"]
        SRC["Source and dependencies"] --> B["Multi-stage build"]
        B --> IMG["Small pinned image"]
        IMG --> SEC["Non-root runtime"]
    end
    SEC --> REG[("Image registry")]
    subgraph K8S["Run and orchestrate"]
        DEP["Deployment"] --> P1["Pod A"]
        DEP --> P2["Pod B"]
        HPA["Horizontal autoscaler"] -.-> DEP
        ING["Ingress"] --> SVC["Stable service"]
        SVC --> P1
        SVC --> P2
    end
    REG --> DEP
    REG -. "Same image" .-> DEV["Laptop and CI"]
\`\`\``;

  CHAPTER_DIAGRAMS["ms-architecture/master-decision-matrix"] = `## Visual Model

\`\`\`mermaid
quadrantChart
    title Architecture fit by domain complexity and operating scale
    x-axis Low operating scale --> High operating scale
    y-axis Simple domain --> Complex domain
    quadrant-1 Distributed architectures
    quadrant-2 Structured core
    quadrant-3 Simple start
    quadrant-4 Scale without domain split
    Monolith: [0.15, 0.20]
    Modular monolith: [0.40, 0.65]
    Microservices: [0.82, 0.86]
    Event driven: [0.72, 0.66]
    Serverless: [0.56, 0.30]
    SOA: [0.90, 0.76]
\`\`\``;

  CHAPTER_DIAGRAMS["ms-architecture/quick-reference-architecture-cheat-sheet"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    S["Start"] --> Q1{"New product with fewer than 10 developers?"}
    Q1 -- "Yes" --> M["Monolith"]
    Q1 -- "No" --> Q2{"Clear boundaries but one deployment is enough?"}
    Q2 -- "Yes" --> MM["Modular monolith"]
    Q2 -- "No" --> Q3{"Teams must deploy and scale independently?"}
    Q3 -- "Yes" --> MS["Microservices"]
    Q3 -- "No" --> Q4{"Event-triggered work with many consumers?"}
    Q4 -- "Yes" --> ED["Event-driven"]
    Q4 -- "No" --> Q5{"Bursty traffic with long idle periods?"}
    Q5 -- "Yes" --> SL["Serverless"]
    Q5 -- "No" --> Q6{"Integrating legacy enterprise systems?"}
    Q6 -- "Yes" --> SOA["SOA"]
    Q6 -- "No" --> R["Reassess requirements"]
\`\`\``;

  CHAPTER_DIAGRAMS["ms-architecture/soa-vs-microservices-side-by-side"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    subgraph SOA["SOA: central integration"]
        SC["Enterprise clients"] --> ESB{{"Enterprise service bus"}}
        ESB --> CS["Coarse customer service"]
        ESB --> OS["Coarse order service"]
        CS --> SD[("Shared enterprise data")]
        OS --> SD
    end
    subgraph MS["Microservices: decentralised ownership"]
        MC["Cloud clients"] --> GW["API gateway"]
        GW --> PR["Profile service"]
        GW --> AU["Auth service"]
        GW --> OR["Order service"]
        PR --> PDB[("Profile data")]
        AU --> ADB[("Auth data")]
        OR --> ODB[("Order data")]
        OR --> EB{{"Event bus"}}
        EB --> PR
    end
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/key-principles-to-internalise"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    subgraph DESIGN["Design the boundaries"]
        B["Bounded contexts"] --> D["Each service owns data"]
        D --> E["Embrace eventual consistency"]
        E --> S["Compensate with sagas"]
    end
    subgraph RUNTIME["Design for runtime reality"]
        F["Assume every call can fail"] --> O["Observe causes, not only symptoms"]
    end
    subgraph DELIVERY["Evolve safely"]
        SIMPLE["Start simple"] --> A["Automate delivery"]
    end
    subgraph ORG["Align people and software"]
        C["Conway's Law"] --> DEC["Decentralised ownership"]
    end
    S --> G["Safe independent change"]
    O --> G
    A --> G
    DEC --> G
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/phase-1-foundations-monolith-vs-microservices"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    N["New or evolving product"] --> Q{"Stable boundaries and a need for independent delivery?"}
    Q -- "No" --> M["Keep one deployable monolith"]
    M --> MM["Create modules around bounded contexts"]
    MM --> L["Learn the domain and team ownership"]
    L --> Q
    Q -- "Yes" --> D["Decompose by bounded context"]
    D --> O["Orders service"]
    D --> I["Inventory service"]
    D --> P["Payments service"]
    O --> OD[("Orders data")]
    I --> ID[("Inventory data")]
    P --> PD[("Payments data")]
    D --> B["Gain independent deploy and scale"]
    D --> C["Accept network, consistency, and operations cost"]
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/phase-7-advanced-patterns-sme-mastery"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    D["Domain model"] --> B["Bounded contexts"]
    T["Team topology"] --> B
    B --> Q{"Architecture pressure"}
    Q -- "Legacy model" --> A["Anti-corruption layer"]
    Q -- "Client-specific needs" --> F["BFF and micro frontends"]
    Q -- "Cross-cutting needs" --> S["Sidecar or ambassador"]
    A --> P["Platform paved road"]
    F --> P
    S --> P
    P --> G["Service catalogue and API standards"]
    G --> Z["Zero trust, mTLS, and secrets"]
    Z --> O["Observe latency, capacity, and cost"]
    O --> R{"Split, merge, or right-size?"}
    R --> B
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/quick-reference-microservices-at-a-glance"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    C["Clients"] --> G["API gateway"]
    R["Service registry"] -.-> G
    G --> O["Orders service"]
    G --> I["Inventory service"]
    G --> P["Payments service"]
    R -.-> O
    R -.-> I
    R -.-> P
    O --> OD[("Orders data")]
    I --> ID[("Inventory data")]
    P --> PD[("Payments data")]
    O -- "Order placed" --> B{{"Event bus"}}
    B -- "Reserve stock" --> I
    I -- "Stock reserved" --> B
    B -- "Take payment" --> P
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/recommended-reading-order"] = `## Visual Model

\`\`\`mermaid
timeline
    title Reading path from foundations to hard trade-offs
    1 Foundation : Building Microservices
    2 Data : Designing Data-Intensive Applications
    3 Patterns : Microservices Patterns
    4 Resilience : Release It
    5 Migration : Monolith to Microservices
    6 Boundaries : Domain-Driven Design
    7 Teams : Team Topologies
    8 Decisions : Software Architecture — The Hard Parts
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/supplementary-practice-projects"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    P1["Project 1: Task system"] --> S1["Boundaries, REST, and async events"]
    S1 --> P2["Project 2: E-commerce"]
    P2 --> S2["Saga, CQRS, resilience, and caching"]
    S2 --> P3["Project 3: Production deployment"]
    P3 --> S3["Containers, Kubernetes, CI/CD, and observability"]
    S3 --> P4["Project 4: Monolith migration"]
    P4 --> S4["Strangler extraction and trade-off records"]
    S4 --> P5["Project 5: Architecture review"]
    P5 --> S5["Complete design, critique, and defence"]
\`\`\``;

  CHAPTER_DIAGRAMS["ms-learning/the-9-key-design-patterns"] = `## Visual Model

\`\`\`mermaid
mindmap
  root((Nine design patterns))
    Entry and discovery
      API Gateway
        One front door
      Service Registry
        Dynamic locations
    Failure isolation
      Circuit Breaker
        Stop failed calls
      Bulkhead
        Contain damage
    Distributed data
      Saga
        Compensate steps
      Event Sourcing
        Replay history
      CQRS
        Split reads and writes
    Integration and migration
      API Composition
        Join service data
      Strangler Fig
        Replace gradually
\`\`\``;

  CHAPTER_DIAGRAMS["ms-pattern-deep-dives/part-6-detailed-real-world-examples"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    W["Write model commits"] --> E{{"Domain event"}}
    E --> T["Tweet posted"]
    T --> TF{"Follower count"}
    TF -- "Regular" --> TW["Precompute timelines"]
    TF -- "Celebrity" --> TR["Merge at read time"]
    E --> U["Ride completed"]
    U --> UR["Rider and surge views in seconds"]
    U --> UB["Tax and ML views in batches"]
    E --> B["Account event"]
    B --> BL["Immutable ledger"]
    BL --> BR["Balance and fraud views"]
    BL --> BC["Statements and regulatory views"]
    E --> S["Track played"]
    S --> SR["Recent plays and ad targeting"]
    S --> SB["Royalties, analytics, and Wrapped"]
\`\`\``;

  // ===================== Message Queues =====================
  CHAPTER_DIAGRAMS["mq-appendix/glossary"] = `## Visual Model

\`\`\`mermaid
mindmap
  root((Message queue glossary))
    Actors
      Producer
      Broker
      Consumer
    Routing
      Queue
      Topic
      Exchange
      Binding and routing key
    Reliability
      ACK and NACK
      Idempotency
      DLQ and poison message
      TTL and durability
    Streaming
      Partition
      Offset
      Consumer group
      Retention and replay
    Flow control
      Backpressure
      Prefetch
      Rebalance
\`\`\``;

  CHAPTER_DIAGRAMS["mq-appendix/official-documentation"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    A{"What are you building?"}
    A -->|Work queue + routing| B["RabbitMQ<br/>or ActiveMQ Artemis"]
    A -->|Replayable event log| C["Kafka, Pulsar,<br/>or Redpanda"]
    A -->|Cloud-managed messaging| D["SQS + SNS, Azure Service Bus,<br/>or GCP Pub/Sub"]
    A -->|Lightweight service bus| E["NATS / JetStream<br/>or Redis Streams"]
    A -->|IoT links| F["MQTT / HiveMQ"]
    A -->|Brokerless sockets| G["ZeroMQ"]
    B --> H["Use official docs for semantics,<br/>limits, deployment, and client APIs"]
    C --> H
    D --> H
    E --> H
    F --> H
    G --> H
\`\`\``;

  CHAPTER_DIAGRAMS["mq-appendix/recommended-reading-and-videos"] = `## Visual Model

\`\`\`mermaid
timeline
    title A practical message-queue learning path
    1 - First principles : RabbitMQ official tutorials : Kafka 101 videos
    2 - Reusable patterns : Enterprise Integration Patterns : CloudAMQP best practices
    3 - Distributed logs : Designing Data-Intensive Applications : Turning the database inside-out
    4 - Production depth : Kafka The Definitive Guide : RabbitMQ in Depth
    5 - Broaden the toolbox : NATS by Example : MQTT Essentials : Pulsar and ZeroMQ guides
\`\`\``;

  CHAPTER_DIAGRAMS["mq-architecture/when-not-to-use-a-message-queue"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    A{"Is the work safely asynchronous?"}
    A -->|"No: answer needed now"| S["Use a synchronous API"]
    A -->|"No: one atomic invariant"| T["Use one database transaction"]
    A -->|Yes| B{"Do separate components need buffering<br/>or independent scaling?"}
    B -->|"No: one process"| F["Use a function call<br/>or an in-memory job"]
    B -->|Yes| C{"Can the business tolerate<br/>eventual consistency?"}
    C -->|No| S
    C -->|Yes| D{"Can the team operate or buy<br/>a reliable broker?"}
    D -->|No| M["Keep the design simpler<br/>or choose a managed service"]
    D -->|Yes| Q["A message queue is justified"]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-deepdives/comparison-selection"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    A{"Need retained history or replay?"}
    A -->|Yes| K["Apache Kafka<br/>partitioned event log"]
    A -->|No| B{"AWS-native and zero broker operations?"}
    B -->|Yes| S["SQS for queues<br/>SNS for fan-out"]
    B -->|No| C{"Need wildcard or header routing?"}
    C -->|Yes| R["RabbitMQ<br/>exchanges + bindings"]
    C -->|No| D{"Already run Redis and data is short-lived?"}
    D -->|Yes| RS["Redis Streams<br/>low-latency buffer"]
    D -->|No| E["Choose the simplest managed or broker option<br/>that meets delivery and scale needs"]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-deepdives/overview"] = `## Visual Model

\`\`\`mermaid
quadrantChart
    title Messaging systems by operations and retention
    x-axis Self-managed --> Fully managed
    y-axis Consume-and-remove --> Retained and replayable
    quadrant-1 Managed replay
    quadrant-2 Durable event logs
    quadrant-3 Task brokers
    quadrant-4 Managed task delivery
    RabbitMQ: [0.18, 0.20]
    Apache Kafka: [0.28, 0.90]
    Redis Streams: [0.46, 0.65]
    AWS SQS and SNS: [0.88, 0.25]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-exercises/exercise-1-simple-producerconsumer-with-rabbitmq-beginner"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
    participant P as producer.py
    participant R as RabbitMQ
    participant C as consumer.py
    P->>R: Declare queue hello
    C->>R: Declare queue hello
    P->>R: Publish Hello, Queue! to hello
    Note over R: The message waits even if no consumer is running
    R-->>C: Deliver the message
    C->>C: Print the payload
    C-->>R: Auto-ACK
    Note over P,C: Reverse startup order and the queue still bridges both processes
\`\`\``;

  CHAPTER_DIAGRAMS["mq-exercises/exercise-2-pubsub-fan-out-with-rabbitmq-topic-exchange-intermediate"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    P["Producer<br/>created, cancelled, shipped"] -->|"routing keys"| X{"orders<br/>topic exchange"}
    X -->|"binding: order.created<br/>created only"| F[("fulfillment")]
    X -->|"binding: order.*<br/>all order events"| A[("analytics")]
    X -->|"binding: #<br/>every routing key"| U[("audit")]
    F --> FC["Fulfillment consumer"]
    A --> AC["Analytics consumer"]
    U --> UC["Audit consumer"]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-exercises/exercise-3-kafka-producerconsumer-with-partitions-intermediate"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    P["Producer<br/>key = customerId"] --> H{"Hash the key"}
    H --> P0["orders P0<br/>ordered offsets"]
    H --> P1["orders P1<br/>ordered offsets"]
    H --> P2["orders P2<br/>ordered offsets"]

    subgraph G2["Consumer group with two members"]
        C1["C1 owns P0 + P1"]
        C2["C2 owns P2"]
    end

    P0 --> C1
    P1 --> C1
    P2 --> C2
    C1 --> M["A member joins or leaves<br/>group processing pauses for rebalance"]
    C2 --> M

    subgraph G3["After C3 joins"]
        R1["C1 owns P0"]
        R2["C2 owns P1"]
        R3["C3 owns P2"]
    end

    M --> R1
    M --> R2
    M --> R3
\`\`\``;

  CHAPTER_DIAGRAMS["mq-foundations/core-vocabulary"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    P["Producer"] -->|creates| M["Message<br/>headers + payload"]
    M -->|publishes| B["Broker"]
    B --> E{"Exchange"}
    E -->|"binding + routing key"| Q[("Queue")]
    Q -->|delivers| C["Consumer"]
    B --> T[["Topic"]]
    T --> PA["Partition<br/>ordered records"]
    PA --> O["Offset<br/>consumer position"]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/aws"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    P["Publisher"] --> T(("SNS topic"))
    T --> STD["SQS Standard<br/>best-effort order, at-least-once"]
    T --> FIFO["SQS FIFO<br/>order by group, dedup window"]
    STD --> R["ReceiveMessage<br/>message becomes invisible"]
    FIFO --> R
    R --> D{"Deleted before<br/>visibility timeout?"}
    D -->|Yes| Done["Processed and removed"]
    D -->|No| V["Visible again<br/>eligible for redelivery"]
    V --> M{"Receive count<br/>over limit?"}
    M -->|No| R
    M -->|Yes| DLQ[("Dead-letter queue")]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/delivery-guarantees"] = `## Visual Model

\`\`\`mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> InFlight: broker delivers
    InFlight --> Completed: process, then ACK
    InFlight --> Ready: NACK, crash, or timeout
    Ready --> DeadLetter: retry limit exceeded
    Completed --> [*]
    DeadLetter --> Inspect: alert and diagnose
    Inspect --> Ready: fix and redrive

    note right of InFlight
      At-most-once ACKs before work.
      At-least-once ACKs after work.
    end note
    note right of Completed
      Effectively exactly-once combines
      at-least-once with atomic deduplication.
    end note
    note left of Ready
      Redelivery is safe only when
      processing is idempotent.
    end note
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/fundamentals"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    P["Producer"] --> B["Broker"]
    B -->|"queue: one copy"| Q[("Task queue")]
    Q -->|"one message to one worker"| W["Competing worker pool"]
    W -->|success + ACK| Done["Work complete"]
    W -->|fails after retries| D[("Dead-letter queue")]
    B -->|"topic: copy per subscription"| T(("Topic"))
    T --> E["Email subscriber"]
    T --> A["Analytics subscriber"]
    T --> S["Search subscriber"]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/kafka"] = `## Visual Model

\`\`\`mermaid
flowchart TB
    P["Producer<br/>batch + key"] --> H{"Key hash"}
    H --> P0["Partition 0<br/>offsets 40, 41, 42"]
    H --> P1["Partition 1<br/>offsets 18, 19, 20"]
    H --> P2["Partition 2<br/>offsets 73, 74, 75"]

    P0 --> C1["Consumer 1"]
    P1 --> C2["Consumer 2"]
    P2 --> C3["Consumer 3"]
    C1 --> O[("Committed group offsets")]
    C2 --> O
    C3 --> O
    O -. "resume or reset for replay" .-> C1

    P0 --> S["Append-only segment files"]
    P1 --> S
    P2 --> S
    S --> R["Retention preserves history;<br/>compaction keeps the latest value per key"]
    S --> T["Sequential I/O + batching + zero-copy<br/>produce high throughput"]
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/rabbitmq"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    P["Producer"] -->|"message + routing key"| X{"Exchange"}
    X --> D["Direct<br/>exact key"]
    X --> F["Fanout<br/>every binding"]
    X --> T["Topic<br/>wildcard pattern"]
    X --> H["Headers<br/>metadata match"]
    D --> R["Binding selects queue"]
    F --> R
    T --> R
    H --> R
    R --> L[("Quorum queue leader")]
    L --> F1[("Follower 1")]
    L --> F2[("Follower 2")]
    L --> M{"Majority persisted?"}
    F1 --> M
    F2 --> M
    M -->|Yes| PC["Publisher confirm"]
    L -->|"delivery tag"| C["Consumer"]
    C -->|"manual ACK"| L
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/system-design"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
    participant C as Client
    participant O as Order Service
    participant D as Orders DB + outbox
    participant B as Partitioned broker
    participant P as Payment consumer
    participant I as Inventory consumer
    participant N as Notification consumer

    C->>O: Place order
    O->>D: Transaction: order pending + OrderCreated outbox
    D-->>O: Commit
    D-->>B: Relay or CDC publishes OrderCreated
    par Independent consumer groups
        B-->>P: Deliver paymentId
        P->>P: Deduplicate and charge atomically
        P-->>B: Publish PaymentSucceeded
    and Notification fan-out
        B-->>N: Deliver order event
        N->>N: Queue channel notifications
    end
    B-->>I: Deliver PaymentSucceeded
    alt Inventory reserved
        I-->>B: Publish StockReserved
        B-->>O: Confirm order
    else Reservation fails
        I-->>B: Publish StockFailed
        B-->>O: Compensate and cancel
    end
\`\`\``;

  CHAPTER_DIAGRAMS["mq-qa/troubleshooting"] = `## Visual Model

\`\`\`mermaid
flowchart TD
    A{"Production symptom"}
    A -->|Backlog or old messages| B{"Consumers healthy?"}
    B -->|No| C["Restore crashed consumers<br/>and inspect errors"]
    B -->|Yes| D{"Processing slower than arrival rate?"}
    D -->|Yes| E["Check downstream latency,<br/>CPU, memory, and poison messages"]
    E --> F["Fix the bottleneck;<br/>enforce retry limit + DLQ"]
    D -->|No| G["Increase prefetch or batch size;<br/>scale only to partition count"]

    A -->|Kafka keeps rebalancing| H["Check poll interval, heartbeat,<br/>GC pauses, crashes, and network"]
    H --> I["Reduce poll work or tune timeouts;<br/>prefer cooperative rebalancing"]

    A -->|Wrong order or schema failures| J{"Which contract broke?"}
    J -->|Ordering| K["Key related events to one partition<br/>or FIFO message group"]
    J -->|Schema| L["Use a registry, defaults,<br/>compatibility checks, and versioning"]

    C --> M["Watch lag, processing rate, errors,<br/>DLQ size, and oldest age"]
    F --> M
    G --> M
    I --> M
    K --> M
    L --> M
\`\`\``;

  CHAPTER_DIAGRAMS["mq-reliability/backpressure-and-flow-control"] = `## Visual Model

\`\`\`mermaid
flowchart LR
    P["Producers<br/>arrival rate"] --> Q[("Broker backlog")]
    Q --> D{"Depth or lag within target?"}
    D -->|Yes| C["Consumer pool<br/>service rate"]
    C -->|"ACK frees credit"| Q
    D -->|No| T["Throttle producers"]
    T -. "lower publish rate" .-> P
    D -->|No| S["Scale consumers"]
    S --> C
    Q --> H{"Hard queue limit reached?"}
    H -->|Yes| O["Reject, drop oldest,<br/>or route overflow"]
    H -->|No| C
    Q -->|"prefetch or batch limit"| C
\`\`\``;

  CHAPTER_DIAGRAMS["mq-reliability/idempotency-and-deduplication"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
    participant B as Broker
    participant C as Consumer
    participant D as Business DB + dedup table
    B->>C: Deliver message id=pay-42
    C->>D: Begin transaction and look up pay-42
    alt ID is new
        D-->>C: Not found
        C->>D: Apply effect and insert unique ID
        C->>D: Commit
    else ID is already stored
        D-->>C: Duplicate
        C->>D: No business change
    end
    C-->>B: ACK
    Note over B,C: If ACK is lost, redelivery follows the duplicate branch
\`\`\``;

  // ===================== Spring Framework =====================
  CHAPTER_DIAGRAMS["spring-advanced/spring-jdbc"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
  participant R as Repository
  participant J as JdbcTemplate
  participant S as DataSource
  participant D as Database
  participant M as RowMapper
  R->>J: Query with parameters
  J->>S: Get connection
  S-->>J: Connection
  J->>D: Execute SQL
  D-->>J: Result set
  loop Each row
    J->>M: Map row
    M-->>J: Domain object
  end
  J->>J: Close resources
  J-->>R: Return objects
\`\`\``;

  CHAPTER_DIAGRAMS["spring-advanced/spring-mvc"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
  participant B as Browser
  participant D as DispatcherServlet
  participant H as HandlerMapping
  participant C as Controller
  participant R as ViewResolver
  participant V as View
  B->>D: HTTP request
  D->>H: Find handler
  H-->>D: Controller method
  D->>C: Invoke handler
  C-->>D: Model and view
  D->>R: Resolve view name
  R-->>D: View
  D->>V: Render model
  V-->>D: HTML
  D-->>B: HTTP response
\`\`\``;

  CHAPTER_DIAGRAMS["spring-qa/aop"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
  participant C as Caller
  participant P as AOP proxy
  participant A as Aspect
  participant T as Target bean
  C->>P: Call method
  P->>A: Before advice
  P->>A: Around advice starts
  A->>T: Proceed
  alt Target returns
    T-->>A: Result
    A-->>P: Result
    P->>A: After returning
    P-->>C: Result
  else Target throws
    T-->>A: Exception
    A-->>P: Exception
    P->>A: After throwing
    P-->>C: Exception
  end
\`\`\``;

  CHAPTER_DIAGRAMS["spring-qa/boot"] = `## Visual Model

\`\`\`mermaid
flowchart TD
  Start[Start application] --> Inspect[Inspect classpath and properties]
  Inspect --> Match{Conditions match}
  Match -->|No| Skip[Skip configuration]
  Match -->|Yes| User{User bean exists}
  User -->|Yes| BackOff[Back off]
  User -->|No| Create[Create default bean]
  Skip --> Ready[Application context ready]
  BackOff --> Ready
  Create --> Ready
  Ready --> Actuator[Health and metrics]
\`\`\``;

  CHAPTER_DIAGRAMS["spring-qa/core"] = `## Visual Model

\`\`\`mermaid
classDiagram
  class BeanFactory
  class ApplicationContext
  class BeanDefinition
  class ManagedBean
  class Dependency
  BeanFactory <|-- ApplicationContext
  ApplicationContext --> BeanDefinition : reads
  ApplicationContext o-- ManagedBean : manages
  ManagedBean --> Dependency : receives
\`\`\``;

  CHAPTER_DIAGRAMS["spring-qa/hibernate"] = `## Visual Model

\`\`\`mermaid
stateDiagram-v2
  [*] --> Transient: New entity
  Transient --> Managed: Persist
  Managed --> Detached: Clear or close
  Detached --> Managed: Merge
  Managed --> Removed: Remove
  Removed --> [*]: Flush
  Managed --> Managed: Dirty checking
\`\`\``;

  CHAPTER_DIAGRAMS["spring-qa/jdbc"] = `## Visual Model

\`\`\`mermaid
classDiagram
  class JdbcTemplate
  class NamedParameterJdbcTemplate
  class DataSource
  class RowMapper
  class SQLExceptionTranslator
  class Database
  NamedParameterJdbcTemplate --> JdbcTemplate : delegates
  JdbcTemplate --> DataSource : obtains connections
  DataSource --> Database : connects
  JdbcTemplate --> RowMapper : maps rows
  JdbcTemplate --> SQLExceptionTranslator : translates errors
\`\`\``;

  CHAPTER_DIAGRAMS["spring-qa/mvc"] = `## Visual Model

\`\`\`mermaid
flowchart TD
  Request[HTTP request] --> Filter[Servlet filter]
  Filter --> Dispatcher[DispatcherServlet]
  Dispatcher --> Interceptor[Handler interceptor]
  Interceptor --> Binding[Binding and validation]
  Binding -->|Valid| Controller[Controller]
  Binding -->|Invalid| Errors[Validation errors]
  Controller --> Response{Response type}
  Response -->|View name| Resolver[View resolver]
  Response -->|Response body| Converter[Message converter]
  Errors --> Advice[Exception handler]
  Resolver --> Result[HTTP response]
  Converter --> Result
  Advice --> Result
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/autowiring-configuration"] = `## Visual Model

\`\`\`mermaid
flowchart TD
  Need[Injection point] --> Type[Find beans by type]
  Type -->|One match| Inject[Inject bean]
  Type -->|Several matches| Qualifier{Qualifier present}
  Qualifier -->|Yes| Named[Select named bean]
  Qualifier -->|No| Primary{Primary bean exists}
  Primary -->|Yes| Default[Select primary bean]
  Primary -->|No| Ambiguous[Ambiguous dependency]
  Type -->|No match| Missing[Missing dependency]
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/bean-management"] = `## Visual Model

\`\`\`mermaid
stateDiagram-v2
  [*] --> Instantiated
  Instantiated --> Populated: Inject dependencies
  Populated --> BeforeInit: Before processors
  BeforeInit --> Initialized: Init callback
  Initialized --> Ready: After processors
  Ready --> Destroyed: Context closes
  Destroyed --> [*]
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/dependency-injection-ioc"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
  participant C as Container
  participant R as Repository
  participant S as Order service
  participant A as Application
  C->>R: Create dependency
  C->>S: Create bean
  C->>S: Inject repository
  A->>S: Place order
  S->>R: Save order
  R-->>S: Saved
  S-->>A: Result
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/framework-benefits"] = `## Visual Model

\`\`\`mermaid
flowchart LR
  Boilerplate[Boilerplate] --> Templates[Spring templates]
  Tight[Tight coupling] --> DI[Dependency injection]
  Mixed[Mixed concerns] --> AOP[AOP]
  Manual[Manual setup] --> Modules[Modular configuration]
  Templates --> LessCode[Less code]
  DI --> Testable[Testable components]
  AOP --> Focused[Focused business logic]
  Modules --> Flexible[Flexible architecture]
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/fundamentals"] = `## Visual Model

\`\`\`mermaid
flowchart LR
  Config[Configuration] --> Container[Spring container]
  Classes[Plain Java classes] --> Container
  Container --> Beans[Wired beans]
  Container --> Services[Framework services]
  Beans --> App[Spring application]
  Services --> App
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/modules"] = `## Visual Model

\`\`\`mermaid
flowchart TB
  Spring[Spring Framework] --> Core[Core container]
  Spring --> Data[Data access]
  Spring --> Web[Web stack]
  Spring --> Cross[Cross cutting]
  Spring --> Test[Test support]
  Core --> CoreParts[Core Beans Context SpEL]
  Data --> DataParts[JDBC ORM Transactions JMS]
  Web --> WebParts[MVC WebFlux WebSocket]
  Cross --> CrossParts[AOP Aspects Instrumentation]
\`\`\``;

  CHAPTER_DIAGRAMS["spring-spring/transaction-management"] = `## Visual Model

\`\`\`mermaid
sequenceDiagram
  participant C as Caller
  participant P as Transaction proxy
  participant T as Transaction manager
  participant S as Service
  participant D as Database
  C->>P: Call method
  P->>T: Begin
  P->>S: Invoke method
  S->>D: Run operations
  alt Method succeeds
    S-->>P: Return result
    P->>T: Commit
    T->>D: Commit transaction
    P-->>C: Return result
  else Method fails
    S-->>P: Throw error
    P->>T: Roll back
    T->>D: Roll back transaction
    P-->>C: Propagate error
  end
\`\`\``;

  CHAPTER_DIAGRAMS["spring-springboot/application-development"] = `## Visual Model

\`\`\`mermaid
flowchart LR
  Initializr[Spring Initializr] --> Project[Generated project]
  Project --> Starters[Starter dependencies]
  Starters --> Main[Application class]
  Main --> Build[Executable JAR]
  Build --> Server[Embedded server]
  Server --> Running[Running application]
\`\`\``;

  CHAPTER_DIAGRAMS["spring-springboot/configuration-files"] = `## Visual Model

\`\`\`mermaid
flowchart TD
  CLI{Command line value} -->|Found| Effective[Effective property]
  CLI -->|Missing| System{System property}
  System -->|Found| Effective
  System -->|Missing| Env{Environment variable}
  Env -->|Found| Effective
  Env -->|Missing| Profile{Profile file}
  Profile -->|Found| Effective
  Profile -->|Missing| Base{Application file}
  Base -->|Found| Effective
  Base -->|Missing| Source{Property source}
  Source -->|Found| Effective
  Source -->|Missing| Default[Default value]
  Effective --> Bind[ConfigurationProperties bean]
  Default --> Bind
\`\`\``;

  CHAPTER_DIAGRAMS["spring-springboot/core-annotations"] = `## Visual Model

\`\`\`mermaid
flowchart TB
  Main[Main application class] --> Boot[SpringBootApplication]
  Boot --> Config[SpringBootConfiguration]
  Boot --> Auto[EnableAutoConfiguration]
  Boot --> Scan[ComponentScan]
  Config --> Definitions[Bean definitions]
  Auto --> Defaults[Conditional defaults]
  Scan --> Components[Detected components]
  Definitions --> Context[Application context]
  Defaults --> Context
  Components --> Context
\`\`\``;

  CHAPTER_DIAGRAMS["spring-springboot/web-development"] = `## Visual Model

\`\`\`mermaid
flowchart LR
  Request[HTTP request] --> Controller[REST controller]
  Controller --> Outcome{Outcome}
  Outcome -->|Success| Converter[Message converter]
  Converter --> Success[JSON response]
  Outcome -->|Exception| Resolver[Exception resolver]
  Resolver --> Advice[Controller advice]
  Advice --> Error[Error response]
\`\`\``;

  // ===================== Design Patterns =====================
  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/chain-of-responsibility"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Chain of Responsibility pattern.

\`\`\`mermaid
classDiagram
direction LR
class Client
class Handler {
  <<interface>>
  +setNext(handler) Handler
  +handle(request)
}
class BaseHandler {
  -next Handler
}
class ConcreteHandlerA
class ConcreteHandlerB
class ConcreteHandlerC
Client --> Handler
Handler <|.. BaseHandler
BaseHandler o--> Handler : next
BaseHandler <|-- ConcreteHandlerA
BaseHandler <|-- ConcreteHandlerB
BaseHandler <|-- ConcreteHandlerC
note for BaseHandler "Each handler either handles the request
or forwards it to the next handler."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/command"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Command pattern.

\`\`\`mermaid
classDiagram
direction TB
class Client
class Invoker {
  -command Command
  +setCommand(command)
  +executeCommand()
}
class Command {
  <<interface>>
  +execute()
}
class ConcreteCommand {
  -receiver Receiver
  -payload
  +execute()
}
class Receiver {
  +action(payload)
}
Client --> Invoker
Client --> ConcreteCommand
Invoker o--> Command
Command <|.. ConcreteCommand
ConcreteCommand --> Receiver
note for Command "Invoker knows only the Command interface.
The command stores its receiver and payload."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/interpreter"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Interpreter pattern.

\`\`\`mermaid
classDiagram
direction TB
class Context
class AbstractExpression {
  <<interface>>
  +interpret(context)
}
class TerminalExpression {
  -value
}
class NonterminalExpression {
  -children
}
AbstractExpression <|.. TerminalExpression
AbstractExpression <|.. NonterminalExpression
NonterminalExpression o--> AbstractExpression : children
AbstractExpression ..> Context
note for AbstractExpression "Expression tree mirrors grammar rules.
Nonterminals combine the results of their children."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/iterator"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Iterator pattern.

\`\`\`mermaid
classDiagram
direction TB
class Client
class IterableCollection {
  <<interface>>
  +createIterator() Iterator
}
class ConcreteCollection {
  -items
}
class Iterator {
  <<interface>>
  +hasNext() boolean
  +next() Element
}
class ConcreteIterator {
  -position
}
Client --> IterableCollection
IterableCollection <|.. ConcreteCollection
Iterator <|.. ConcreteIterator
ConcreteCollection ..> ConcreteIterator : creates
note for Iterator "Iterator owns traversal state.
The collection storage stays hidden."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/mediator"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Mediator pattern.

\`\`\`mermaid
classDiagram
direction TB
class BaseColleague {
  -mediator Mediator
}
class ColleagueA
class ColleagueB
class ColleagueC
class Mediator {
  <<interface>>
  +notify(sender, event)
}
class ConcreteMediator
BaseColleague <|-- ColleagueA
BaseColleague <|-- ColleagueB
BaseColleague <|-- ColleagueC
BaseColleague --> Mediator
Mediator <|.. ConcreteMediator
note for Mediator "Colleagues talk only to the mediator.
The mediator owns all interaction rules."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/memento"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Memento pattern.

\`\`\`mermaid
classDiagram
direction TB
class Originator {
  -state
  +save() Memento
  +restore(memento)
}
class Memento {
  -state
  +getState()
}
class Caretaker {
  -history
  +backup()
  +undo()
}
Originator ..> Memento : creates
Caretaker o--> Memento : stores
note for Memento "Memento is opaque to the Caretaker.
Only the Originator can read its state."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/observer"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Observer pattern.

\`\`\`mermaid
classDiagram
direction TB
class Subject {
  -observers
  +attach(observer)
  +detach(observer)
  +notify()
}
class ConcreteSubject {
  -state
  +setState(state)
  +getState()
}
class Observer {
  <<interface>>
  +update(subject)
}
class ConcreteObserverA
class ConcreteObserverB
class ConcreteObserverC
Subject <|-- ConcreteSubject
Observer <|.. ConcreteObserverA
Observer <|.. ConcreteObserverB
Observer <|.. ConcreteObserverC
Subject o--> Observer : subscribers
note for Subject "On state change Subject.notify()
calls update() on every subscribed observer."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/state"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the State pattern.

\`\`\`mermaid
classDiagram
direction TB
class Context {
  -state State
  +request()
  +setState(state)
}
class State {
  <<interface>>
  +handle(context)
}
class ConcreteStateA
class ConcreteStateB
class ConcreteStateC
Context o--> State
State <|.. ConcreteStateA
State <|.. ConcreteStateB
State <|.. ConcreteStateC
note for Context "Context delegates each request() to its state.
States can switch the Context to another state."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/strategy"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Strategy pattern.

\`\`\`mermaid
classDiagram
direction TB
class Context {
  -strategy Strategy
  +setStrategy(strategy)
  +executeStrategy(input)
}
class Strategy {
  <<interface>>
  +execute(input)
}
class ConcreteStrategyA
class ConcreteStrategyB
class ConcreteStrategyC
Context o--> Strategy
Strategy <|.. ConcreteStrategyA
Strategy <|.. ConcreteStrategyB
Strategy <|.. ConcreteStrategyC
note for Context "Context just forwards to the active Strategy.
No algorithm branching lives in Context."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/template-method"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Template Method pattern.

\`\`\`mermaid
classDiagram
direction TB
class AbstractClass {
  +templateMethod()
  +stepOne()
  #stepTwo()
  #stepThree()
  +hookStep()
}
class ConcreteClass1 {
  #stepTwo()
  #stepThree()
  +hookStep()
}
class ConcreteClass2 {
  #stepTwo()
  #stepThree()
}
AbstractClass <|-- ConcreteClass1
AbstractClass <|-- ConcreteClass2
note for AbstractClass "templateMethod() defines the fixed step order.
Subclasses override only the variable steps."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-behavioral-patterns/visitor"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Visitor pattern.

\`\`\`mermaid
classDiagram
direction TB
class ObjectStructure {
  -elements
  +accept(visitor)
}
class Element {
  <<interface>>
  +accept(visitor)
}
class ConcreteElementA
class ConcreteElementB
class Visitor {
  <<interface>>
  +visitElementA(element)
  +visitElementB(element)
}
class ExportVisitor
class ReportVisitor
ObjectStructure o--> Element
Element <|.. ConcreteElementA
Element <|.. ConcreteElementB
Visitor <|.. ExportVisitor
Visitor <|.. ReportVisitor
note for Visitor "Each element calls the visitor method
that matches its concrete type (double dispatch)."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-creational-patterns/abstract-factory"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Abstract Factory pattern.

\`\`\`mermaid
classDiagram
direction TB
class AbstractFactory {
  <<interface>>
  +createProductA() ProductA
  +createProductB() ProductB
}
class ConcreteFactory1
class ConcreteFactory2
class ProductA {
  <<interface>>
}
class ProductB {
  <<interface>>
}
class ProductA1
class ProductA2
class ProductB1
class ProductB2
AbstractFactory <|.. ConcreteFactory1
AbstractFactory <|.. ConcreteFactory2
ProductA <|.. ProductA1
ProductA <|.. ProductA2
ProductB <|.. ProductB1
ProductB <|.. ProductB2
ConcreteFactory1 ..> ProductA1 : creates
ConcreteFactory1 ..> ProductB1 : creates
ConcreteFactory2 ..> ProductA2 : creates
ConcreteFactory2 ..> ProductB2 : creates
note for AbstractFactory "Each ConcreteFactory builds
one complete family of compatible products."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-creational-patterns/builder"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Builder pattern.

\`\`\`mermaid
classDiagram
direction TB
class Director {
  -builder Builder
  +construct()
}
class Builder {
  <<interface>>
  +reset()
  +buildPartA()
  +buildPartB()
}
class ConcreteBuilder1 {
  -product Product1
  +reset()
  +buildPartA()
  +buildPartB()
  +getResult() Product1
}
class ConcreteBuilder2 {
  -product Product2
  +reset()
  +buildPartA()
  +buildPartB()
  +getResult() Product2
}
class Product1
class Product2
Director o--> Builder
Builder <|.. ConcreteBuilder1
Builder <|.. ConcreteBuilder2
ConcreteBuilder1 ..> Product1 : assembles
ConcreteBuilder2 ..> Product2 : assembles
note for Director "Director knows the construction order.
Each ConcreteBuilder assembles its own Product."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-creational-patterns/factory-method"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Factory Method pattern.

\`\`\`mermaid
classDiagram
direction TB
class Creator {
  <<abstract>>
  +someOperation()
  +factoryMethod() Product
}
class ConcreteCreatorA {
  +factoryMethod() Product
}
class ConcreteCreatorB {
  +factoryMethod() Product
}
class Product {
  <<interface>>
  +use()
}
class ConcreteProductA
class ConcreteProductB
Creator <|-- ConcreteCreatorA
Creator <|-- ConcreteCreatorB
Product <|.. ConcreteProductA
Product <|.. ConcreteProductB
ConcreteCreatorA ..> ConcreteProductA : creates
ConcreteCreatorB ..> ConcreteProductB : creates
note for Creator "Creator declares factoryMethod().
Subclasses choose the concrete Product to create."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-creational-patterns/prototype"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Prototype pattern.

\`\`\`mermaid
classDiagram
direction TB
class Prototype {
  <<interface>>
  +clone() Prototype
}
class ConcretePrototypeA {
  -fieldA
  +clone() Prototype
}
class ConcretePrototypeB {
  -fieldB
  +clone() Prototype
}
class PrototypeRegistry {
  -prototypes
  +getByKey(key) Prototype
}
PrototypeRegistry o--> Prototype
Prototype <|.. ConcretePrototypeA
Prototype <|.. ConcretePrototypeB
note for Prototype "clone() returns a copy of an existing object
instead of running its constructor again."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-creational-patterns/singleton"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Singleton pattern.

\`\`\`mermaid
classDiagram
direction TB
class Client
class Singleton {
  -instance$ Singleton
  -Singleton()
  +getInstance()$ Singleton
  +businessOperation()
}
Client ..> Singleton : getInstance()
note for Singleton "Private constructor.
The same instance is reused for every getInstance() call."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/adapter"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Adapter pattern.

\`\`\`mermaid
classDiagram
direction LR
class Client
class Target {
  <<interface>>
  +request()
}
class Adapter {
  -adaptee Adaptee
  +request()
}
class Adaptee {
  +specificRequest()
}
Client --> Target
Target <|.. Adapter
Adapter o--> Adaptee
note for Adapter "Adapter implements Target.
It converts request() into Adaptee.specificRequest()."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/bridge"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Bridge pattern.

\`\`\`mermaid
classDiagram
direction TB
class Abstraction {
  -implementor Implementor
  +operation()
}
class RefinedAbstraction {
  +operation()
  +extraFeature()
}
class Implementor {
  <<interface>>
  +operationImpl()
}
class ConcreteImplementorA
class ConcreteImplementorB
Abstraction <|-- RefinedAbstraction
Abstraction o--> Implementor
Implementor <|.. ConcreteImplementorA
Implementor <|.. ConcreteImplementorB
note for Abstraction "Abstraction holds an Implementor.
Both hierarchies can grow independently."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/composite"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Composite pattern.

\`\`\`mermaid
classDiagram
direction TB
class Component {
  <<interface>>
  +operation()
  +add(component)
  +remove(component)
}
class Leaf {
  +operation()
}
class Composite {
  -children
  +operation()
  +add(component)
  +remove(component)
}
Component <|.. Leaf
Component <|.. Composite
Composite o--> Component : children
note for Composite "Composite delegates operation() to its children.
Clients treat Leaf and Composite uniformly."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/decorator"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Decorator pattern.

\`\`\`mermaid
classDiagram
direction TB
class Component {
  <<interface>>
  +operation()
}
class ConcreteComponent {
  +operation()
}
class BaseDecorator {
  -wrappee Component
  +operation()
}
class ConcreteDecoratorA {
  +operation()
  +extraBehaviorA()
}
class ConcreteDecoratorB {
  +operation()
  +extraBehaviorB()
}
Component <|.. ConcreteComponent
Component <|.. BaseDecorator
BaseDecorator o--> Component : wrappee
BaseDecorator <|-- ConcreteDecoratorA
BaseDecorator <|-- ConcreteDecoratorB
note for BaseDecorator "Each Decorator forwards to its wrappee
and adds behavior before or after."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/facade"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Facade pattern.

\`\`\`mermaid
classDiagram
direction TB
class Client
class Facade {
  +operation()
}
class SubsystemA
class SubsystemB
class SubsystemC
Client --> Facade
Facade --> SubsystemA
Facade --> SubsystemB
Facade --> SubsystemC
note for Facade "Facade hides multi-step subsystem
coordination behind one narrow API."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/flyweight"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Flyweight pattern.

\`\`\`mermaid
classDiagram
direction TB
class FlyweightFactory {
  -cache
  +getFlyweight(key) Flyweight
}
class Flyweight {
  <<interface>>
  +operation(extrinsicState)
}
class ConcreteFlyweight {
  -intrinsicState
  +operation(extrinsicState)
}
class Context {
  -extrinsicState
  -flyweight Flyweight
}
FlyweightFactory o--> Flyweight
Flyweight <|.. ConcreteFlyweight
Context o--> Flyweight
note for ConcreteFlyweight "Intrinsic state is shared in the Flyweight.
Each Context supplies its own extrinsic state."
\`\`\``;

  CHAPTER_DIAGRAMS["design-lld-structural-patterns/proxy"] = `## Reference Class Diagram (GoF)

The classic Gang of Four structure for the Proxy pattern.

\`\`\`mermaid
classDiagram
direction LR
class Client
class Subject {
  <<interface>>
  +request()
}
class RealSubject {
  +request()
}
class Proxy {
  -realSubject RealSubject
  +request()
}
Client --> Subject
Subject <|.. RealSubject
Subject <|.. Proxy
Proxy o--> RealSubject
note for Proxy "Proxy implements Subject.
It can do auth, caching, or lazy creation first."
\`\`\``;

}());
 