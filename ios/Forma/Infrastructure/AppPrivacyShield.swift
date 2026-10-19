import SwiftUI
import UIKit

/// A window-level cover includes presented forms and the training sheet in app snapshots.
struct AppPrivacyShield: UIViewRepresentable {
    func makeUIView(context: Context) -> ShieldAnchor { ShieldAnchor() }
    func updateUIView(_ uiView: ShieldAnchor, context: Context) {}

    final class ShieldAnchor: UIView {
        private var cover: UIView?

        override init(frame: CGRect) {
            super.init(frame: frame)
            isUserInteractionEnabled = false
            NotificationCenter.default.addObserver(self, selector: #selector(hideContent), name: UIApplication.willResignActiveNotification, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(revealContent), name: UIApplication.didBecomeActiveNotification, object: nil)
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
        deinit { NotificationCenter.default.removeObserver(self) }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window == nil { revealContent() }
            else if UIApplication.shared.applicationState != .active { hideContent() }
        }

        @objc private func hideContent() {
            guard let window else { return }
            if let cover { window.bringSubviewToFront(cover); return }
            let cover = UIView(frame: window.bounds)
            cover.backgroundColor = .systemBackground
            cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            cover.accessibilityElementsHidden = true
            let title = UILabel()
            title.text = "Forma"
            title.font = .preferredFont(forTextStyle: .largeTitle)
            title.textAlignment = .center
            title.translatesAutoresizingMaskIntoConstraints = false
            cover.addSubview(title)
            NSLayoutConstraint.activate([
                title.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                title.centerYAnchor.constraint(equalTo: cover.centerYAnchor)
            ])
            window.addSubview(cover)
            self.cover = cover
        }

        @objc private func revealContent() { cover?.removeFromSuperview(); cover = nil }
    }
}
