import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../@/components/ui/tabs';
import { AlertTriangle, Shield, Cookie } from 'lucide-react';

interface LegalDialogsProps {
    defaultTab?: 'disclaimer' | 'privacy' | 'cookies';
    trigger?: React.ReactNode;
}

export function LegalDialogs({ defaultTab = 'disclaimer', trigger }: LegalDialogsProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="text-muted-foreground hover:text-foreground underline">
                        Legal info
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>About This Tool</DialogTitle>
                    <DialogDescription>
                        A few important things to know
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue={defaultTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="disclaimer" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Disclaimer
                        </TabsTrigger>
                        <TabsTrigger value="privacy" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Privacy
                        </TabsTrigger>
                        <TabsTrigger value="cookies" className="text-xs">
                            <Cookie className="h-3 w-3 mr-1" />
                            Cookies
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="disclaimer" className="mt-4 text-sm space-y-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="font-medium text-amber-800 dark:text-amber-200">
                                ⚠️ This is a hobby project — please do your own research!
                            </p>
                        </div>

                        <div className="space-y-3 text-muted-foreground">
                            <p>
                                I built this calculator to help people get a rough idea of whether solar panels
                                and batteries might be worth it for them. It uses your real usage data and actual
                                historical weather, so it should give you a reasonable ballpark figure.
                            </p>
                            <p>
                                <strong className="text-foreground">But please don't rely on it alone.</strong> There
                                are lots of things that can affect real-world results:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Your roof might face the wrong way or have shading</li>
                                <li>Weather varies year to year (we use historical data)</li>
                                <li>Tariff rates change over time</li>
                                <li>Equipment degrades (~0.5% per year for panels)</li>
                                <li>Installation quality matters a lot</li>
                                <li>Our model uses simple "greedy" battery dispatch, not smart scheduling</li>
                            </ul>
                            <p>
                                Before spending any money, <strong className="text-foreground">get proper quotes from
                                    MCS-certified installers</strong> who can survey your property. They'll give you
                                much more accurate figures based on your actual roof, orientation, and local conditions.
                            </p>
                            <p className="text-xs pt-2 border-t">
                                This isn't financial advice. I'm just someone who made a calculator —
                                I can't be held responsible for any decisions you make based on it.
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="privacy" className="mt-4 text-sm space-y-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <p className="font-medium text-emerald-800 dark:text-emerald-200">
                                🔒 Your data stays in your browser
                            </p>
                        </div>

                        <div className="space-y-3 text-muted-foreground">
                            <p>
                                I don't have a server. Everything happens in your browser. When you close the page,
                                it's gone.
                            </p>

                            <div>
                                <p className="font-medium text-foreground mb-1">What happens with your data:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong>Your Octopus API key</strong> — sent directly to Octopus to fetch your usage.
                                        Never stored anywhere.</li>
                                    <li><strong>Your consumption data</strong> — fetched from Octopus, processed in your
                                        browser, then forgotten.</li>
                                    <li><strong>Your postcode</strong> — pulled from your Octopus account, used to look up
                                        weather data. Not stored.</li>
                                </ul>
                            </div>

                            <div>
                                <p className="font-medium text-foreground mb-1">External services used:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong>Octopus Energy</strong> — for your usage data</li>
                                    <li><strong>NASA POWER</strong> — for historical solar irradiance</li>
                                    <li><strong>Postcodes.io</strong> — to convert postcode to coordinates</li>
                                </ul>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="cookies" className="mt-4 text-sm space-y-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="font-medium text-blue-800 dark:text-blue-200">
                                🍪 No tracking, no analytics
                            </p>
                        </div>

                        <div className="space-y-3 text-muted-foreground">
                            <p>
                                I don't use Google Analytics or any tracking. I have no idea how many
                                people use this or what they do with it.
                            </p>

                            <div>
                                <p className="font-medium text-foreground mb-1">Local storage:</p>
                                <p>
                                    The browser might save your theme preference (light/dark mode) locally.
                                    That's it. You can clear it anytime in your browser settings.
                                </p>
                            </div>

                            <div>
                                <p className="font-medium text-foreground mb-1">Third-party cookies:</p>
                                <p>
                                    The APIs I call (Octopus, NASA, Postcodes.io) might set their own cookies —
                                    I don't control that. Check their policies if you're curious.
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                    Last updated: January 2026
                </p>
            </DialogContent>
        </Dialog>
    );
}