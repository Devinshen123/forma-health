import Foundation

/// Mirrors the service's food-photo contract in `src/types.ts`. The estimate is the service's;
/// the record that may come out of it is the person's, and only after they have reviewed every
/// value. Nothing here calls a model, and a draft is never a record until they say so.
public struct FoodPhotoNutrients: Codable, Equatable, Sendable {
    public let kcal: Double?
    public let protein: Double?
    public let carbs: Double?
    public let fat: Double?

    public init(kcal: Double?, protein: Double?, carbs: Double?, fat: Double?) {
        self.kcal = kcal
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
    }
}

public struct FoodPhotoItem: Codable, Equatable, Sendable {
    public let name: String
    /// The portion the service guessed, or nil when it would not guess one.
    public let grams: Double?
    /// Per 100 g, the reference the records themselves use.
    public let per100g: FoodPhotoNutrients

    public init(name: String, grams: Double?, per100g: FoodPhotoNutrients) {
        self.name = name
        self.grams = grams
        self.per100g = per100g
    }
}

public struct FoodPhotoDraft: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let assetId: String
    public let provider: String
    public let model: String
    public let createdAt: String
    /// The service's own answer to whether the photo is food at all.
    public let isFood: Bool
    public let items: [FoodPhotoItem]
    public let warnings: [String]

    public init(id: String, assetId: String, provider: String, model: String, createdAt: String,
                isFood: Bool, items: [FoodPhotoItem], warnings: [String]) {
        self.id = id
        self.assetId = assetId
        self.provider = provider
        self.model = model
        self.createdAt = createdAt
        self.isFood = isFood
        self.items = items
        self.warnings = warnings
    }

    /// Tolerates a service newer than this build: an item it cannot read is dropped rather
    /// than taking the whole draft with it, and a draft with no readable item is no draft.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        assetId = try container.decode(String.self, forKey: .assetId)
        provider = (try? container.decode(String.self, forKey: .provider)) ?? ""
        model = (try? container.decode(String.self, forKey: .model)) ?? ""
        createdAt = (try? container.decode(String.self, forKey: .createdAt)) ?? ""
        isFood = (try? container.decode(Bool.self, forKey: .isFood)) ?? false
        items = ((try? container.decode([FoodPhotoItem].self, forKey: .items)) ?? [])
        warnings = ((try? container.decode([String].self, forKey: .warnings)) ?? [])
    }
}

/// What this deployment can actually do, read from `/api/capabilities` rather than assumed.
public struct FoodPhotoCapability: Codable, Equatable, Sendable {
    public let available: Bool
    public let provider: String?
    /// The service's own word for why, shown as it is rather than guessed at.
    public let reason: String?

    public init(available: Bool, provider: String?, reason: String?) {
        self.available = available
        self.provider = provider
        self.reason = reason
    }
}

public struct ServiceCapabilities: Codable, Equatable, Sendable {
    public let ai: Bool
    public let foodPhoto: FoodPhotoCapability?

    public init(ai: Bool, foodPhoto: FoodPhotoCapability?) {
        self.ai = ai
        self.foodPhoto = foodPhoto
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ai = (try? container.decode(Bool.self, forKey: .ai)) ?? false
        foodPhoto = try? container.decode(FoodPhotoCapability.self, forKey: .foodPhoto)
    }
}
