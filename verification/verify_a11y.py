from playwright.sync_api import sync_playwright, expect

def verify_a11y():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000")

        # Verify Labels
        print("Checking labels...")

        # Map of input ID -> Label Text
        expected_associations = {
            "transitionSelect": "Transition",
            "transitionDurRange": "Transition Time",
            "speedRange": "Speed",
            "resolutionRange": "Resolution",
            "contrastRange": "Contrast",
            "slideDuration": "Duration",
            "timelineZoom": "Zoom"
        }

        for input_id, label_text in expected_associations.items():
            # Check if the label with the 'for' attribute exists and contains the text
            label = page.locator(f"label[for='{input_id}']")
            expect(label).to_be_visible()
            expect(label).to_contain_text(label_text)
            print(f"✅ Label for {input_id} found and associated correctly.")

        # Verify Buttons
        print("Checking buttons...")

        add_btn = page.locator("#addSlideBtn")
        expect(add_btn).to_have_attribute("aria-label", "Add Images")
        print("✅ Add Slide button has aria-label.")

        del_btn = page.locator("#deleteSlideBtn")
        expect(del_btn).to_have_attribute("aria-label", "Delete Clip")
        print("✅ Delete Slide button has aria-label.")

        # Take screenshot
        page.screenshot(path="verification/a11y_check.png")
        print("📸 Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_a11y()
