# Helping Services — Algorithmic Specifications (`algorithms.md`)

This document provides formal mathematical formulations, algorithmic pseudo-code, parameter definitions, and operational mechanics for the 4 core algorithms powering the **Helping Services** backend.

---

## Algorithm 1: User Interest & Academic Profile Personalized Feed Ranking

### 1.1 Objective
Dynamically score and arrange products in a user's home and category feeds based on their academic curriculum (UG/PG and department), browsing/cart history, and instruction overrides delivered by the User Analysis Engine sub-backend.

### 1.2 Mathematical Formulation
For any active candidate product $P \in \mathcal{P}$ and user $u \in \mathcal{U}$, the composite feed score $\mathcal{S}(u, P)$ is defined as:

$$\mathcal{S}(u, P) = S_{\text{base}} + S_{\text{academic}}(u, P) + S_{\text{interest}}(u, P) + S_{\text{cart\_dwell}}(u, P) + S_{\text{sub\_backend}}(P) + S_{\text{popularity}}(P)$$

Where:
1. **$S_{\text{base}} = 10.0$**: Guarantees a non-zero baseline score.
2. **Academic Alignment Score ($S_{\text{academic}}$)**:
   $$S_{\text{academic}}(u, P) = \mathbb{I}(u.\text{course} \in P.\text{targetCourses}) \cdot 15.0 + \mathbb{I}(u.\text{dept} \in P.\text{targetDepts}) \cdot 15.0$$
3. **Behavioral Interest Affinity Score ($S_{\text{interest}}$)**:
   $$S_{\text{interest}}(u, P) = \min\left(30.0, \, 0.6 \cdot \mathcal{A}_{\text{cat}}(u, P.\text{cat})\right) + \min\left(15.0, \, \sum_{t \in P.\text{tags}} \mathcal{W}_{\text{tag}}(u, t)\right)$$
   Where $\mathcal{A}_{\text{cat}}(u, c) \in [0, 100]$ is the user's category affinity weight, and $\mathcal{W}_{\text{tag}}(u, t)$ is the tag weight.
4. **Cart Dwell Time Score ($S_{\text{cart\_dwell}}$)**:
   Derived via **Algorithm 2** (see Section 2).
5. **Sub-Backend Instruction Overrides ($S_{\text{sub\_backend}}$)**:
   $$S_{\text{sub\_backend}}(P) = \begin{cases}
   +30.0 & \text{if } P.\text{cat} \in \mathcal{C}_{\text{boost}} \\
   -50.0 & \text{if } P.\text{cat} \in \mathcal{C}_{\text{suppress}} \\
   0.0 & \text{otherwise}
   \end{cases} \quad + \; \mathcal{W}_{\text{custom}}(P.\text{cat})$$
6. **Popularity & Freshness ($S_{\text{popularity}}$)**:
   $$S_{\text{popularity}}(P) = \min\left(10.0, \, 1.5 \cdot P.\text{sales} + 0.1 \cdot P.\text{views}\right) + \mathbb{I}(P.\text{isFeatured}) \cdot 10.0$$

### 1.3 Pseudo-Code
```python
def rank_personalized_feed(user_id, category_filter, page, limit):
    candidate_products = CatalogDB.Product.find(isActive=True, isDeleted=False, category=category_filter)
    
    if not user_id:
        # Fallback to guest trending strategy
        for p in candidate_products:
            p.score = 10.0 + min(20.0, p.salesCount * 2 + p.viewCount * 0.1) + (15.0 if p.isFeatured else 0.0)
        return sort_and_paginate(candidate_products, page, limit)
    
    user = CoreDB.User.findById(user_id)
    cart = AnalyticsDB.Cart.findOne(userId=user_id)
    profile = AnalyticsDB.UserInterestProfile.findOne(userId=user_id)
    
    dwelling_categories = extract_dwelling_categories(cart, threshold_minutes=15)
    cart_product_ids = {item.productId for item in cart.items} if cart else set()
    
    scored_products = []
    for p in candidate_products:
        score = 10.0
        
        # Academic match
        if user.course in p.targetCourses: score += 15.0
        if user.department in p.targetDepartments: score += 15.0
        
        # Behavioral interest
        cat_weight = profile.get_category_affinity(p.category) if profile else 0
        score += min(30.0, cat_weight * 0.6)
        
        # Cart dwell boost (Algorithm 2)
        if p.id in cart_product_ids:
            score += 40.0
        elif p.category in dwelling_categories:
            dwell_mins = dwelling_categories[p.category]
            score += 25.0 + min(25.0, math.log2(1 + dwell_mins / 15.0) * 10.0)
            
        # Sub-backend overrides
        if profile and profile.engineInstructions:
            if p.category in profile.engineInstructions.boostCategories: score += 30.0
            if p.category in profile.engineInstructions.suppressCategories: score -= 50.0
            score += profile.engineInstructions.customWeights.get(p.category, 0.0)
            
        # Popularity
        score += min(10.0, p.salesCount * 1.5 + p.viewCount * 0.1)
        if p.isFeatured: score += 10.0
        
        scored_products.append((p, score))
        
    scored_products.sort(key=lambda x: x[1], reverse=True)
    return paginate(scored_products, page, limit)
```

---

## Algorithm 2: Cart Dwell Time & Purchase Intent Priority Engine

### 2.1 Problem & Motivation
In e-commerce and student campus shopping, adding an item to a cart without immediate checkout indicates **high interest coupled with purchase hesitation**. If a user keeps an item in their cart across multiple hours or days, elevating products from that category to the top of the feed dramatically improves conversion and checkout completion.

### 2.2 Mathematical Formulation
For any product $P$ and user cart $\mathcal{K}$, let:
- $\tau_{\text{now}}$ be the current epoch time in milliseconds.
- $\tau_{\text{add}}(i)$ be the timestamp when item $i \in \mathcal{K}$ was added to the cart.
- $\Delta t(i) = \max\left(0, \left\lfloor \frac{\tau_{\text{now}} - \tau_{\text{add}}(i)}{60,000} \right\rfloor\right)$ be the dwell time in minutes.

The category maximum dwell time $\mathcal{D}(c)$ is:
$$\mathcal{D}(c) = \max_{i \in \mathcal{K}, \, i.\text{cat} = c} \Delta t(i)$$

The Cart Dwell Time Intent Boost $S_{\text{cart\_dwell}}(u, P)$ is formulated as:

$$S_{\text{cart\_dwell}}(u, P) = \begin{cases}
+40.0 & \text{if } P.\text{id} \in \{i.\text{productId} \mid i \in \mathcal{K}\} \\
25.0 + \min\left(25.0, \, 10.0 \cdot \log_2\left(1 + \frac{\mathcal{D}(P.\text{cat})}{15}\right)\right) & \text{if } \mathcal{D}(P.\text{cat}) \ge 15 \\
0.0 & \text{otherwise}
\end{cases}$$

### 2.3 Complexity
- **Time Complexity**: $\mathcal{O}(|\mathcal{K}|)$ to calculate category dwell times in a single pass over cart items, followed by $\mathcal{O}(1)$ map lookup per candidate product during feed scoring.
- **Space Complexity**: $\mathcal{O}(|\mathcal{K}|)$ hash map in memory.

---

## Algorithm 3: Contextual Accessory & Chained Cross-Sell Recommendation Engine

### 3.1 Objective
Given a target product $P$ (e.g., iPhone 15), generate an intelligent two-tier accessory recommendation set. If the user adds an accessory (e.g., Silicone Protective Case) to their cart/purchase list, dynamically activate **Chained Accessory Expansion** to surface next-tier accessories (e.g., Tempered Glass Screen Protector, Lens Guard, MagSafe Wallet).

### 3.2 Recommendation Graph Mechanics

```
 [Primary Product: iPhone 15]
          |
          +---> (Essential) ---> [20W USB-C Fast Charger]
          |
          +---> (Recommended) -> [Silicone Case with MagSafe]
                                              |
                          (User adds Case to Cart/Purchase List)
                                              |
                                              v
                              [Chained Expansion Activates!]
                                              |
                   +--------------------------+--------------------------+
                   |                                                     |
                   v                                                     v
  [Tempered Glass Screen Protector]                             [Camera Lens Guard]
```

### 3.3 Graph Traversal & Chained Expansion Procedure
1. **Tier 1 (Direct Compatible Accessories)**:
   - Query $P$'s `compatibleAccessories` array in Catalog DB.
   - Filter out any product IDs that are already present in the user's active cart $\mathcal{K}_{\text{ids}}$.
   - Partition into `Essential` and `Recommended`.
2. **Tier 2 (Chained Accessory Expansion)**:
   - Identify all accessories $\mathcal{A}_{\text{selected}}$ that are currently in the cart:
     $$\mathcal{A}_{\text{selected}} = \{a \in P.\text{compatibleAccessories} \mid a.\text{productId} \in \mathcal{K}_{\text{ids}}\}$$
   - If $|\mathcal{A}_{\text{selected}}| > 0$:
     - For each selected accessory $a_k \in \mathcal{A}_{\text{selected}}$, retrieve $a_k$'s own `compatibleAccessories` list from Catalog DB.
     - Add unselected child accessories to the `chainedAccessories` pool.
     - Query popular complementary accessories within the categories of selected items.
     - Deduplicate and rank by `salesCount` and `priority`.
     - Generate a dynamic bundle discount incentive callout (e.g., *"Add 1 more accessory to get 10% off"*).

---

## Algorithm 4: 3-Day Registration Abandonment Reminder Engine

### 4.1 Objective
Prevent user drop-off when an applicant fills out their complete registration form (name, DOB, gender, addresses, mobile, college) but fails to enter their email OTP.

### 4.2 Algorithm Steps
1. The background scheduler initiates a scan every interval $\Delta T$ (default: daily or on-demand).
2. Compute the 3-day threshold cutoff:
   $$\tau_{\text{cutoff}} = \tau_{\text{now}} - (3 \times 24 \times 60 \times 60 \times 1000) \text{ ms}$$
3. Execute indexed query in Core DB:
   $$\mathcal{R}_{\text{pending}} = \text{CoreDB.PendingRegistration.find}\left(\left\{\text{status}: \text{'pending'}, \, \text{lastReminderSentAt} \le \tau_{\text{cutoff}}\right\}\right)$$
4. For each pending applicant $r \in \mathcal{R}_{\text{pending}}$:
   - Generate a fresh 6-digit numeric OTP:
     $$\text{OTP}_{\text{fresh}} = \text{random\_int}(100000, 999999)$$
   - Update $r.\text{otp} = \text{OTP}_{\text{fresh}}$.
   - Extend expiration window: $r.\text{otpExpiresAt} = \tau_{\text{now}} + (24 \times 60 \times 60 \times 1000) \text{ ms}$.
   - Reset $r.\text{otpAttempts} = 0$.
   - Update $r.\text{lastReminderSentAt} = \tau_{\text{now}}$.
   - Increment $r.\text{reminderCount} \leftarrow r.\text{reminderCount} + 1$.
   - Save document.
   - Dispatch HTML/text reminder email via Nodemailer.

---

## Algorithm 5: Intelligent Multi-Field Product Search, Typo Tolerance, & Dynamic Facet Engine

### 5.1 Objective
Deliver a lightning-fast, fault-tolerant, and context-aware product search system that understands user intent, forgives typos (e.g., *"iphne"* $\rightarrow$ *"iphone"*, *"chagre"* $\rightarrow$ *"charger"*), personalizes rankings according to academic curriculum and cart dwell state, extracts multi-dimensional facets dynamically, and logs search history for trending analytics.

### 5.2 Mathematical & Algorithmic Formulation

#### 1. Damerau-Levenshtein Typo Distance & Similarity Ratio
For query token $a$ and vocabulary term $b$, the edit distance $d_{L}(a, b)$ accounts for insertions, deletions, substitutions, and transpositions of adjacent characters:

$$d_{L}(a, b) = \min \begin{cases}
0 & \text{if } i=0, j=0 \\
i & \text{if } j=0 \\
j & \text{if } i=0 \\
D(i-1, j) + 1 & \text{deletion} \\
D(i, j-1) + 1 & \text{insertion} \\
D(i-1, j-1) + \mathbb{I}(a[i] \ne b[j]) & \text{substitution} \\
D(i-2, j-2) + 1 & \text{transposition if } a[i]=b[j-1] \text{ and } a[i-1]=b[j]
\end{cases}$$

The normalized similarity ratio $\text{sim}(a, b)$ is formulated as:

$$\text{sim}(a, b) = 1.0 - \frac{d_{L}(a, b)}{\max(|a|, |b|)}$$

A vocabulary candidate is accepted as a typo replacement if:
$$d_{L}(a, b) \le 2 \quad \land \quad \text{sim}(a, b) \ge 0.75$$

#### 2. Composite Multi-Field Relevance Score Matrix
For a candidate product $P$ and search query tokens $\mathcal{T} = \{t_1, t_2, \dots, t_k\}$, the final search score $\mathcal{S}_{\text{search}}(u, P, \mathcal{T})$ is computed as:

$$\mathcal{S}_{\text{search}}(u, P, \mathcal{T}) = S_{\text{relevance}}(P, \mathcal{T}) + S_{\text{personalization}}(u, P) + S_{\text{business}}(P)$$

**Field Relevance Weight Matrix ($S_{\text{relevance}}$)**:
- **Exact SKU Match**: $+50.0$ if $q_{\text{raw}} = P.\text{sku}$
- **Title Field Matching**:
  - Exact word match: $+10.0$ per matched token
  - Prefix match: $+5.0$ per matched token
  - Substring match: $+3.0$ per matched token
  - Fuzzy word match: $+6.0 \cdot \text{sim}(t, w)$ if $\text{sim} \ge 0.75$
- **Brand Match**: $+8.0$ if $t = P.\text{brand}$
- **Category & SubCategory Match**: $+7.0$ if $t \in \{P.\text{cat}, P.\text{subCat}\}$
- **Tags Match**: $+5.0$ per matching tag
- **Description Match**: $+1.5$ per substring match

**Personalization Factors ($S_{\text{personalization}}$)**:
- Academic Course Alignment (UG/PG): $+10.0$
- Academic Department Alignment: $+10.0$
- Category Affinity Weight: $+\min(15.0, \, 0.3 \cdot \mathcal{A}_{\text{cat}}(u, P.\text{cat}))$
- **Cart Dwell Urgency Synergy (Algorithm 2)**: $+25.0$ if $P.\text{category}$ is currently dwelling in user's active cart $\ge 15$ minutes!

**Business & Operational Adjustments ($S_{\text{business}}$)**:
- In-Stock Availability: $+10.0$ ($P.\text{stock} > 0$), or $-15.0$ penalty ($P.\text{stock} = 0$)
- Sales & View Count: $+\min(10.0, \, 1.2 \cdot P.\text{sales} + 0.05 \cdot P.\text{views})$
- Featured Promotion: $+5.0$ if $P.\text{isFeatured} = \text{true}$

### 5.3 Dynamic Facet Extraction
In a single execution pass over matched candidate products, dynamic facets are generated:
- $\mathcal{F}_{\text{categories}}$: Distinct categories with product frequency counts $\left(c_i, n_i\right)$
- $\mathcal{F}_{\text{brands}}$: Distinct brands with product frequency counts $\left(b_i, n_i\right)$
- $\mathcal{F}_{\text{tags}}$: Top 15 matching tags sorted by frequency
- $\mathcal{F}_{\text{priceRange}}$: Extreme lower and upper bounds $[\min(\text{price}), \max(\text{price})]$

### 5.4 Autocomplete / Typeahead Engine
Evaluates keystroke prefixes $\ge 1$ char:
- Executes indexed regex on `Product.title`, `Product.category`, `Product.brand`, and `Product.tags`
- Returns top 8 product previews, top 4 categories, and top 4 brands with instantaneous response times ($< 15$ ms)

### 5.5 Trending & Search Analytics Pipeline
1. Every search execution is asynchronously recorded in Analytics DB (`SearchHistory` collection) without adding latency to the search response.
2. Trending searches aggregate normalized queries over a sliding 7-day window:
   $$\text{Trending} = \text{Top}_{N}\left(\sum_{\tau \ge \tau_{\text{now}} - 7d} \mathbb{I}(\text{normalizedQuery} = q)\right)$$
3. Authenticated users can retrieve their deduplicated recent search history and selectively clear it.

---

## Algorithm 6: 2-Day Post-Registration Rating Prompt & Weekly Periodic Re-Prompt Engine

### 6.1 Objective
Optimize user engagement and app review quality by prompting users for star ratings (1 to 5 stars) and optional feedback only after they have experienced the platform for at least 2 days. Guarantee submission permanence (never prompt again once submitted) and respect user intent when dismissed by applying a strict 7-day weekly re-prompt cooldown.

### 6.2 Mathematical Model & State Machine

Let:
- $\tau_{\text{now}}$: Current Unix epoch timestamp in milliseconds.
- $\tau_{\text{reg}}$: User account creation timestamp (`User.createdAt` in Core DB).
- $T \in \{\text{'app'}, \text{'partner'}\}$: Target entity evaluated for rating.
- $\sigma(u, T)$: Rating prompt state tuple $(\text{hasSubmitted}, \tau_{\text{dismiss}}, k_{\text{dismiss}})$ in Analytics DB.

#### 1. Registration Age & Cooldown
$$\Delta \tau_{\text{reg}} = \tau_{\text{now}} - \tau_{\text{reg}}$$
$$\mathcal{C}_{\text{reg}}(u) = \begin{cases}
\text{TRUE} & \text{if } \Delta \tau_{\text{reg}} \ge 2 \times 24 \times 60 \times 60 \times 1000 \text{ ms} \quad (48\text{ hours}) \\
\text{FALSE} & \text{otherwise}
\end{cases}$$

#### 2. Submission Permanence Guard
If $\sigma(u, T).\text{hasSubmitted} = \text{TRUE}$:
$$\mathcal{E}(u, T) = \text{FALSE} \quad \forall \; \tau \ge \tau_{\text{submit}} \quad (\text{Terminal State: Never Show Again})$$

#### 3. Dismissal & Weekly Cooldown Loop
When the user dismisses or ignores the prompt at timestamp $\tau_{\text{dismiss}}$:
$$\tau_{\text{next\_eligible}} = \tau_{\text{dismiss}} + (7 \times 24 \times 60 \times 60 \times 1000) \text{ ms}$$
$$\Delta \tau_{\text{dismiss}} = \tau_{\text{now}} - \tau_{\text{dismiss}}$$
$$\mathcal{C}_{\text{weekly}}(u, T) = \begin{cases}
\text{TRUE} & \text{if } \Delta \tau_{\text{dismiss}} \ge 7 \times 24 \times 60 \times 60 \times 1000 \text{ ms} \quad (1\text{ week}) \\
\text{FALSE} & \text{otherwise}
\end{cases}$$

#### 4. Composite Decision Function
$$\mathcal{E}(u, T) = \neg \sigma(u, T).\text{hasSubmitted} \;\land\; \mathcal{C}_{\text{reg}}(u) \;\land\; \left(k_{\text{dismiss}} = 0 \;\lor\; \mathcal{C}_{\text{weekly}}(u, T)\right)$$

### 6.3 Algorithmic Pseudo-Code

```python
def check_rating_prompt_eligibility(user_id, target_type, partner_id=None):
    user = CoreDB.User.findById(user_id)
    if not user or not user.isVerified or user.isDeleted:
        return {"shouldPrompt": False, "reason": "user_not_eligible"}

    state = AnalyticsDB.RatingPromptState.findOne(userId=user_id, targetType=target_type, partnerId=partner_id)
    
    # Rule 1: Never show again if user already submitted
    if state and state.hasSubmitted:
        return {"shouldPrompt": False, "reason": "already_submitted", "hasSubmitted": True}

    now = current_timestamp()
    
    # Rule 2: 2-Day registration delay
    two_days_ms = 2 * 24 * 60 * 60 * 1000
    if (now - user.createdAt) < two_days_ms:
        hours_remaining = ceil((two_days_ms - (now - user.createdAt)) / (1000 * 60 * 60))
        return {"shouldPrompt": False, "reason": "registration_cooldown", "hoursRemaining": hours_remaining}

    # Rule 3: Weekly cooldown if previously dismissed
    seven_days_ms = 7 * 24 * 60 * 60 * 1000
    if state and state.lastDismissedAt:
        if (now - state.lastDismissedAt) < seven_days_ms:
            days_remaining = ceil((seven_days_ms - (now - state.lastDismissedAt)) / (1000 * 60 * 60 * 24))
            return {"shouldPrompt": False, "reason": "weekly_cooldown", "daysRemaining": days_remaining}
        
        # 7 days elapsed since dismissal -> weekly re-prompt
        return {"shouldPrompt": True, "reason": "eligible_weekly_reprompt", "dismissCount": state.dismissCount}

    # Rule 4: Initial prompt (registered >= 2 days ago, never dismissed)
    return {"shouldPrompt": True, "reason": "eligible_initial_prompt", "dismissCount": 0}
```

### 6.4 Complexity & Storage Analysis
- **Evaluation Time**: $\mathcal{O}(1)$ via indexed compound lookups (`userId`, `targetType`, `partnerId`).
- **Storage Footprint**: Minimal single document per user-target pair in Analytics DB, with zero polling write amplification.

---

## Algorithm 7: Geospatial Proximity & Real-Time Location Telemetry Pipeline

### 7.1 Objective
Capture real-time geographic telemetry (latitude, longitude, speed, heading, accuracy) from student and partner devices, index spatial coordinates on an ellipsoidal Earth model (WGS84), and stream live location states to the Admin Sub-Backend for operational mapping and fleet coordination.

### 7.2 Mathematical Formulation & Great-Circle Distance

#### 1. Haversine Metric
For any two coordinates on the Earth's surface $P_1 = (\phi_1, \lambda_1)$ and $P_2 = (\phi_2, \lambda_2)$ where $\phi$ is latitude in radians and $\lambda$ is longitude in radians:

$$\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1$$

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$c = 2 \cdot \arctan2\left(\sqrt{a}, \, \sqrt{1-a}\right)$$

$$d = R \cdot c$$

Where mean Earth radius $R = 6,371,000\text{ meters}$.

#### 2. Spatial Indexing ($2\text{dsphere}$)
Locations are formatted as GeoJSON Points:
$$\mathbf{x} = [ \lambda, \, \phi ] \quad (\text{longitude precedes latitude})$$

The `2dsphere` index computes spherical geometry queries ($S_{\text{geo}}$):
$$S_{\text{geo}}(P_{\text{origin}}, r_{\text{max}}) = \{ u \in \mathcal{U} \mid d(u.\mathbf{x}, P_{\text{origin}}) \le r_{\text{max}} \}$$

Query complexity is $\mathcal{O}(\log N)$ via hierarchical geohash B-tree index traversal.

### 7.3 Algorithmic Pseudo-Code

```python
def process_realtime_location(user_id, lat, lng, accuracy, speed, heading):
    # 1. Bounds validation
    assert -90.0 <= lat <= 90.0
    assert -180.0 <= lng <= 180.0
    
    user = CoreDB.User.findById(user_id)
    now = current_timestamp()
    
    # 2. Persist in Analytics DB
    location_doc = AnalyticsDB.UserLocation.create({
        "userId": user_id,
        "role": user.role,
        "location": {"type": "Point", "coordinates": [lng, lat]},
        "latitude": lat,
        "longitude": lng,
        "accuracy": accuracy,
        "speed": speed,
        "heading": heading,
        "timestamp": now
    })
    
    # 3. Update User snapshot in Core DB
    user.lastLocation = {
        "type": "Point",
        "coordinates": [lng, lat],
        "latitude": lat,
        "longitude": lng,
        "accuracy": accuracy,
        "updatedAt": now
    }
    user.save()
    
    # 4. Stream to Admin Sub-Backend
    event_payload = {
        "id": location_doc.id,
        "userId": user_id,
        "userName": user.name,
        "role": user.role,
        "collegeName": user.collegeName,
        "latitude": lat,
        "longitude": lng,
        "speed": speed,
        "timestamp": now
    }
    
    in_memory_event_buffer.push_front(event_payload)
    async_post_webhook(ADMIN_SUB_BACKEND_URL + "/api/v1/internal/locations/stream", event_payload)
    
    return location_doc
```


